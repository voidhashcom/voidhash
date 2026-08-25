<?php

namespace Voidhash\Generated\Core\Endpoint;

class IngestPolicySetCustomEventBlocked extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $eventName;
    /**
     * @param string $eventName
     * @param \Voidhash\Generated\Core\Model\SetCustomEventBlockedBodyJsonEncoding $requestBody
     */
    public function __construct(string $eventName, \Voidhash\Generated\Core\Model\SetCustomEventBlockedBodyJsonEncoding $requestBody)
    {
        $this->eventName = $eventName;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{eventName}'], [$this->eventName], '/api/v1/ingest-policy/custom-events/{eventName}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\SetCustomEventBlockedBodyJsonEncoding) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\EventAdmissionPolicyJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\EventAdmissionPolicyJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiEventAdmissionErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}