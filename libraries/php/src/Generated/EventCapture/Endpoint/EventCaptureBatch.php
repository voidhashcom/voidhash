<?php

namespace Voidhash\Generated\EventCapture\Endpoint;

class EventCaptureBatch extends \Voidhash\Generated\EventCapture\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\EventCapture\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\EventCapture\Model\IV1BatchPostBody $requestBody
     * @param array{
     *    "x-secret-key"?: string,
     * } $headerParameters
     */
    public function __construct(\Voidhash\Generated\EventCapture\Model\IV1BatchPostBody $requestBody, array $headerParameters = [])
    {
        $this->body = $requestBody;
        $this->headerParameters = $headerParameters;
    }
    use \Voidhash\Generated\EventCapture\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/i/v1/batch';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\EventCapture\Model\IV1BatchPostBody) {
            return [['Content-Type' => ['application/json']], $serializer->serialize($this->body, 'json')];
        }
        return [[], null];
    }
    public function getExtraHeaders(): array
    {
        return ['Accept' => ['application/json']];
    }
    protected function getHeadersOptionsResolver(): \Symfony\Component\OptionsResolver\OptionsResolver
    {
        $optionsResolver = parent::getHeadersOptionsResolver();
        $optionsResolver->setDefined(['x-secret-key']);
        $optionsResolver->setRequired([]);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('x-secret-key', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchBadRequestException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchUnauthorizedException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchRequestEntityTooLargeException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchTooManyRequestsException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchInternalServerErrorException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchServiceUnavailableException
     *
     * @return null|\Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (202 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestError', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedError', 'json'), $response);
        }
        if (is_null($contentType) === false && (413 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchRequestEntityTooLargeException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeError', 'json'), $response);
        }
        if (is_null($contentType) === false && (429 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchTooManyRequestsException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureInternalServerError', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableError', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}