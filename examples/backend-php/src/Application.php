<?php

declare(strict_types=1);

namespace Voidhash\Example;

use Psr\Http\Client\ClientExceptionInterface;
use Voidhash\Example\Billing\FakePay;
use Voidhash\Example\Billing\FakePayProvider;
use Voidhash\Example\Controller\BillingWebhookController;
use Voidhash\Example\Controller\EventsController;
use Voidhash\Example\Controller\HealthController;
use Voidhash\Example\Controller\MeController;
use Voidhash\Example\Controller\NotesController;
use Voidhash\Example\Controller\ProviderController;
use Voidhash\Example\Controller\WebhookController;
use Voidhash\Example\Exception\HttpException;
use Voidhash\Example\Exception\VoidhashUnavailableException;
use Voidhash\Example\Nimbus\Analytics;
use Voidhash\Example\Nimbus\EntitlementCache;
use Voidhash\Example\Nimbus\EntitlementResolver;
use Voidhash\Example\Nimbus\NoteStore;
use Voidhash\Example\Nimbus\StateFile;
use Voidhash\Example\Nimbus\WebhookHandler;
use Voidhash\Exception\ApiException;
use Voidhash\Provider\ProviderHandler;
use Voidhash\VoidhashClient;

/**
 * Wiring. Everything the service is made of is constructed here, once, from a
 * validated {@see Config}.
 */
final class Application
{
    private function __construct(
        private readonly Router $router,
        private readonly Logger $logger,
    ) {
    }

    public static function create(Config $config, ?Logger $logger = null): self
    {
        $logger ??= new Logger();
        // One credential covers everything, event ingest included. Without a
        // project id the SDK asks Voidhash for the key's project on its first
        // call; setting it saves that round trip.
        $client = VoidhashClient::create($config->secretKey, [
            'baseUrl' => $config->baseUrl,
            'ingestUrl' => $config->ingestUrl,
            'projectId' => $config->projectId,
        ]);

        $notes = new NoteStore(StateFile::in($config->stateDir, 'notes.json'));
        $entitlements = new EntitlementCache(
            StateFile::in($config->stateDir, 'entitlements.json'),
            new EntitlementResolver($client),
            $logger,
        );
        $analytics = new Analytics($client, $logger);
        $notesController = new NotesController($notes, $entitlements, $analytics);

        $router = new Router();
        $router->add(HttpMethod::Get, '/health', new HealthController());
        $router->add(HttpMethod::Get, '/v1/me', new MeController($entitlements, $notes));
        $router->add(HttpMethod::Get, '/v1/notes', $notesController->list(...));
        $router->add(HttpMethod::Post, '/v1/notes', $notesController->create(...));
        $router->add(HttpMethod::Get, '/v1/notes/export', $notesController->export(...));
        $router->add(HttpMethod::Post, '/v1/events', new EventsController($analytics));
        $router->add(HttpMethod::Post, '/webhooks/voidhash', new WebhookController(
            new WebhookHandler(StateFile::in($config->stateDir, 'webhooks.json'), $entitlements, $logger),
            $logger,
            $config->webhookSecret,
        ));

        // A payment source: payments taken by a provider Voidhash does not
        // integrate natively (here the stand-in FakePay), reported by its
        // webhook route and answered for on the provider endpoint.
        $fakePay = new FakePay(StateFile::in($config->stateDir, 'fakepay.json'));
        $router->add(HttpMethod::Post, '/voidhash/provider', new ProviderController(
            $config->providerSecret === null
                ? null
                : new ProviderHandler($config->paymentSource, $config->providerSecret, new FakePayProvider($fakePay)),
        ));
        $router->add(HttpMethod::Post, '/billing/webhook', new BillingWebhookController(
            $fakePay,
            $config->paymentSourceId === null ? null : $client->paymentSources->source($config->paymentSourceId),
        ));

        return new self($router, $logger);
    }

    /** Serves the current SAPI request and ends the exchange. */
    public function run(): void
    {
        try {
            $response = $this->handle(Request::fromGlobals());
        } catch (HttpException $exception) {
            // Reading the request can fail on its own — an unsupported method,
            // for instance — before there is anything to route.
            $response = self::fromHttpException($exception);
        }

        $response->send();

        // Hand the connection back before shutdown functions run, so work
        // deferred by the webhook route happens off the caller's clock.
        Response::finishRequest();
    }

    /**
     * Routes one request and turns every failure into a JSON body.
     *
     * The mapping is the interesting part. `ApiException::getErrorCode()` and
     * `getType()` carry the server's own reason, so failures are branched on
     * those rather than on a status code that several unrelated errors share —
     * and none of them are reflected back at the caller as-is. A rejected
     * secret key is a 500 because it is our bug, not theirs.
     */
    public function handle(Request $request): Response
    {
        try {
            return $this->router->dispatch($request);
        } catch (HttpException $exception) {
            return self::fromHttpException($exception);
        } catch (ApiException $exception) {
            return $this->fromApiException($exception, $request);
        } catch (VoidhashUnavailableException | ClientExceptionInterface $exception) {
            $this->logger->error('voidhash transport failure', [
                'path' => $request->path,
                'cause' => $exception->getMessage(),
            ]);

            return Response::error(503, 'voidhash_unavailable', 'Voidhash could not be reached; try again shortly');
        } catch (\Throwable $throwable) {
            $this->logger->error('unhandled error', [
                'path' => $request->path,
                'cause' => $throwable->getMessage(),
                'type' => $throwable::class,
            ]);

            return Response::error(500, 'internal_error', 'something went wrong');
        }
    }

    private static function fromHttpException(HttpException $exception): Response
    {
        return Response::error(
            $exception->getStatus(),
            $exception->getErrorCode(),
            $exception->getMessage(),
            $exception->getExtra(),
        );
    }

    private function fromApiException(ApiException $exception, Request $request): Response
    {
        // The request id is what Voidhash support asks for.
        $this->logger->error('voidhash api error', [
            'path' => $request->path,
            'status' => $exception->getStatus(),
            'type' => $exception->getType(),
            'code' => $exception->getErrorCode(),
            'requestId' => $exception->getRequestId(),
        ]);

        return match (true) {
            $exception->getErrorCode() === 'person_not_found' => Response::error(
                404,
                'person_not_found',
                'no person with that distinct id',
            ),
            // The SDK refused the call as configured, or the configured
            // project or payment source does not exist: our deployment's bug.
            in_array($exception->getErrorCode(), ['configuration_error', 'project_not_found', 'payment_provider_not_found'], true) => Response::error(
                500,
                'voidhash_misconfigured',
                'the Voidhash client is misconfigured on this server',
            ),
            $exception->getType() === 'unauthenticated' || $exception->getType() === 'permission_denied' => Response::error(
                500,
                'voidhash_key_rejected',
                'this server\'s Voidhash secret key was rejected',
            ),
            $exception->getStatus() >= 500 || $exception->getStatus() === 0 => Response::error(
                503,
                'voidhash_unavailable',
                'Voidhash could not be reached; try again shortly',
            ),
            default => Response::error(502, 'voidhash_error', 'Voidhash rejected the request', [
                'code' => $exception->getErrorCode(),
            ]),
        };
    }
}
