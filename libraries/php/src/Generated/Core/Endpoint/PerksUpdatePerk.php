<?php

namespace Voidhash\Generated\Core\Endpoint;

class PerksUpdatePerk extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $perkId;
    /**
     * @param string $perkId
     * @param \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding $requestBody
     */
    public function __construct(string $perkId, \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding $requestBody)
    {
        $this->perkId = $perkId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PATCH';
    }
    public function getUri(): string
    {
        return str_replace(['{perkId}'], [$this->perkId], '/api/v1/perks/{perkId}');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkConflictException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\PerkJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PerkJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksUpdatePerkUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksUpdatePerkForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksUpdatePerkNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPerkNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksUpdatePerkConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPerkSlugAlreadyExistsErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\PerksUpdatePerkInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}