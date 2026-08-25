<?php

namespace Voidhash\Generated\Core\Endpoint;

class PaywallDeploysCreateDeploy extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * @param mixed $requestBody
     */
    public function __construct($requestBody)
    {
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/api/v1/paywall-deploys';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if (isset($this->body)) {
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
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (201 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallDeployUpgradeRequiredErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (422 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployUnprocessableEntityException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPaywallDeployValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}