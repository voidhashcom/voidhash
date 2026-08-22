<?php

namespace Voidhash\Generated\EventCapture\Endpoint;

class EventCaptureCapture extends \Voidhash\Generated\EventCapture\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\EventCapture\Runtime\Client\Endpoint
{
    /**
     * @param \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody $requestBody
     */
    public function __construct(\Voidhash\Generated\EventCapture\Model\IV1CapturePostBody $requestBody)
    {
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\EventCapture\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/i/v1/capture';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody) {
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
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureBadRequestException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureUnauthorizedException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureRequestEntityTooLargeException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureTooManyRequestsException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureInternalServerErrorException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureServiceUnavailableException
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
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureBadRequestException($response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureUnauthorizedError', 'json'), $response);
        }
        if (is_null($contentType) === false && (413 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureRequestEntityTooLargeException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeError', 'json'), $response);
        }
        if (is_null($contentType) === false && (429 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureTooManyRequestsException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureRateLimitedError', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureInternalServerError', 'json'), $response);
        }
        if (is_null($contentType) === false && (503 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureServiceUnavailableException($serializer->deserialize($body, 'Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableError', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return [];
    }
}