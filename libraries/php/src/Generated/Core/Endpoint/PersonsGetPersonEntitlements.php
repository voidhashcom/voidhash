<?php

namespace Voidhash\Generated\Core\Endpoint;

class PersonsGetPersonEntitlements extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $personId;
    /**
     * @param string $personId
     */
    public function __construct(string $personId)
    {
        $this->personId = $personId;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'GET';
    }
    public function getUri(): string
    {
        return str_replace(['{personId}'], [$this->personId], '/api/v1/persons/{personId}/entitlements');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPersonNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}