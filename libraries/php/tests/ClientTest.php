<?php

declare(strict_types=1);

namespace Voidhash\Tests;

use PHPUnit\Framework\TestCase;
use Voidhash\Exception\ApiException;
use Voidhash\VoidhashClient;
use Voidhash\Webhooks;
use Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding;
use Voidhash\Generated\Core\Model\SetPersonAttributesBodyJsonEncoding;

final class ClientTest extends TestCase
{
    private StubHttpClient $http;
    private VoidhashClient $client;

    protected function setUp(): void
    {
        $this->http = new StubHttpClient();
        $this->client = VoidhashClient::create('vh_sk_test', ['httpClient' => $this->http]);
    }

    public function testGetByDistinctIdSendsAuthHeaderAndDecodes(): void
    {
        $this->http->queueJson(200, ['personId' => 'per_1', 'distinctId' => 'user-123', 'email' => null, 'name' => null]);

        $person = $this->client->persons->getByDistinctId('user-123');

        self::assertSame('per_1', $person?->getPersonId());
        $request = $this->http->requests[0];
        self::assertSame('/api/v1/persons/by-distinct-id/user-123', $request->getUri()->getPath());
        self::assertSame('vh_sk_test', $request->getHeaderLine('x-secret-key'));
    }

    public function testCaptureSendsTheIngestContractWithThePublishableKey(): void
    {
        $client = VoidhashClient::create('vh_sk_test', [
            'httpClient' => $this->http,
            'publishableKey' => 'vh_pk_test',
        ]);
        $this->http->queueJson(202, ['accepted' => 1, 'rejected' => 0]);

        $result = $client->eventCapture->capture([
            'event' => 'note_created',
            'distinctId' => 'user-123',
        ]);

        self::assertSame(['accepted' => 1, 'rejected' => 0], $result);

        $request = $this->http->requests[0];
        self::assertSame('/i/v1/capture', $request->getUri()->getPath());
        // Ingest authenticates on the body token; the secret key must not leak
        // onto this origin.
        self::assertSame('', $request->getHeaderLine('x-secret-key'));

        $body = json_decode((string) $request->getBody(), true);
        self::assertSame('note_created', $body['event']);
        self::assertSame('user-123', $body['distinct_id']);
        self::assertSame('vh_pk_test', $body['token']);
        self::assertNotEmpty($body['uuid']);
        self::assertNotEmpty($body['sent_at']);
        // Both must be JSON objects; `[]` is rejected with a 400.
        self::assertStringContainsString('"context":{}', (string) $request->getBody());
        self::assertStringContainsString('"properties":{}', (string) $request->getBody());
    }

    public function testCaptureWithoutAPublishableKeyIsAConfigurationError(): void
    {
        self::assertFalse($this->client->eventCapture->isEnabled());

        $this->expectException(ApiException::class);
        $this->client->eventCapture->capture(['event' => 'note_created', 'distinctId' => 'user-123']);
    }

    public function testSetAttributesPostsTraitsForTheNamedPerson(): void
    {
        $this->http->queueJson(200, ['personId' => 'per_1', 'distinctId' => 'user-123', 'email' => null, 'name' => null]);

        $person = $this->client->persons->setAttributes(
            (new SetPersonAttributesBodyJsonEncoding())
                ->setDistinctId('user-123')
                ->setTraits(['plan' => 'pro', 'notes_created' => 3]),
        );

        self::assertSame('per_1', $person?->getPersonId());
        $request = $this->http->requests[0];
        self::assertSame('/api/v1/persons/attributes', $request->getUri()->getPath());
        self::assertSame('vh_sk_test', $request->getHeaderLine('x-secret-key'));

        $body = json_decode((string) $request->getBody(), true);
        self::assertSame('user-123', $body['distinctId']);
        self::assertSame(['plan' => 'pro', 'notes_created' => 3], $body['traits']);
    }

    public function testErrorMappingCarriesStatusAndTag(): void
    {
        $this->http->queueJson(404, ['_tag' => 'Api/PersonNotFoundError', 'id' => 'per_missing']);

        try {
            $this->client->persons->get('per_missing');
            self::fail('expected ApiException');
        } catch (ApiException $exception) {
            self::assertSame(404, $exception->getStatus());
            self::assertSame('Api/PersonNotFoundError', $exception->getTag());
        }
    }

    public function testHasActivePerkBySlugAndById(): void
    {
        $perks = fn (): array => [
            ['id' => 'perk_free', 'name' => 'Free', 'projectId' => 'prj_1', 'slug' => 'free'],
            ['id' => 'perk_pro', 'name' => 'Pro', 'projectId' => 'prj_1', 'slug' => 'pro'],
        ];
        // perks list (once per hasActivePerk call with a slug selector)
        $this->http->queueJson(200, $perks());
        // person lookup
        $this->http->queueJson(200, ['personId' => 'per_1', 'distinctId' => 'user-1']);
        // entitlements
        $this->http->queueJson(200, [
            'grants' => [[
                'perkId' => 'perk_pro',
                'status' => 'active',
                'expiresAt' => null,
                'source' => 'subscription',
                'sourceId' => null,
                'sourcePersonId' => 'per_1',
            ]],
        ]);
        // second round for the free-perk lookup
        $this->http->queueJson(200, $perks());
        $this->http->queueJson(200, ['personId' => 'per_1', 'distinctId' => 'user-1']);
        $this->http->queueJson(200, ['grants' => []]);

        $active = $this->client->persons->entitlements->hasActivePerk([
            'distinctId' => 'user-1',
            'perkSlug' => 'pro',
        ]);
        self::assertTrue($active);

        $inactive = $this->client->persons->entitlements->hasActivePerk([
            'distinctId' => 'user-1',
            'perkSlug' => 'free',
        ]);
        self::assertFalse($inactive);
    }

    public function testHasActivePerkRequiresExactlyOneSelector(): void
    {
        $this->expectException(ApiException::class);
        $this->client->persons->entitlements->hasActivePerk(['distinctId' => 'user-1']);
    }

    public function testUnknownPersonResolvesToFalseForHasActivePerk(): void
    {
        $this->http->queueJson(404, ['_tag' => 'Api/PersonNotFoundError', 'id' => 'ghost']);

        $active = $this->client->persons->entitlements->hasActivePerk([
            'distinctId' => 'ghost',
            'perkId' => 'perk_pro',
        ]);
        self::assertFalse($active);
    }

    public function testApiKeysCreateSendsBodyAndDecodesRawKey(): void
    {
        $this->http->queueJson(200, [
            'apiKey' => ['id' => 'key_1', 'name' => 'ci', 'projectId' => 'prj_1', 'maskedKey' => 'vh_sk_***'],
            'rawKey' => 'vh_sk_raw',
        ]);

        $params = (new CreateSecretKeyBodyJsonEncoding())->setName('ci')->setProjectId('prj_1');
        $created = $this->client->apiKeys->create($params);

        self::assertSame('vh_sk_raw', $created?->getRawKey());
        $request = $this->http->requests[0];
        self::assertSame('/api/v1/api-keys', $request->getUri()->getPath());
    }

    public function testEmptySecretKeyIsRejected(): void
    {
        $this->expectException(ApiException::class);
        VoidhashClient::create('  ');
    }
}
