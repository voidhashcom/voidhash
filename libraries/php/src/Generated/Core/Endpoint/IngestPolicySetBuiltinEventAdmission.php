<?php

namespace Voidhash\Generated\Core\Endpoint;

class IngestPolicySetBuiltinEventAdmission extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $key;
    /**
     * @param string $key
     * @param \Voidhash\Generated\Core\Model\SetBuiltinEventAdmissionBodyJsonEncoding $requestBody
     */
    public function __construct(string $key, \Voidhash\Generated\Core\Model\SetBuiltinEventAdmissionBodyJsonEncoding $requestBody)
    {
        $this->key = $key;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{key}'], [$this->key], '/api/v1/ingest-policy/builtin-events/{key}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\SetBuiltinEventAdmissionBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionInternalServerErrorException
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
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiEventAdmissionErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiAuthServiceErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}