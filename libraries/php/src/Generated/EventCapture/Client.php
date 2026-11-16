<?php

namespace Voidhash\Generated\EventCapture;

class Client extends \Voidhash\Generated\EventCapture\Runtime\Client\Client
{
    /**
     * Captures one event. Authorize with the `x-secret-key` header from a server, or a publishable `token` in the body from an app or web page. Answers 202 with how many events were stored.
     * @param \Voidhash\Generated\EventCapture\Model\IV1CapturePostBody $requestBody
     * @param array{
     *    "x-secret-key"?: string, //A project secret key, `vh_sk_...`, for requests from your servers. Leave it out when the body has a publishable `token`.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureBadRequestException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureUnauthorizedException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureRequestEntityTooLargeException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureTooManyRequestsException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureInternalServerErrorException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureCaptureServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse : \Psr\Http\Message\ResponseInterface)
     */
    public function eventCaptureCapture(\Voidhash\Generated\EventCapture\Model\IV1CapturePostBody $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\EventCapture\Endpoint\EventCaptureCapture($requestBody, $headerParameters), $fetch);
    }
    /**
     * Captures 1 to 100 events in one request, authorized like a single capture. One invalid event rejects the whole request. Answers 202 with how many events were stored.
     * @param \Voidhash\Generated\EventCapture\Model\IV1BatchPostBody $requestBody
     * @param array{
     *    "x-secret-key"?: string, //A project secret key, `vh_sk_...`, for requests from your servers. Leave it out when the body has a publishable `token`.
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchBadRequestException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchUnauthorizedException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchRequestEntityTooLargeException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchTooManyRequestsException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchInternalServerErrorException
     * @throws \Voidhash\Generated\EventCapture\Exception\EventCaptureBatchServiceUnavailableException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\EventCapture\Model\CaptureAcceptedResponse : \Psr\Http\Message\ResponseInterface)
     */
    public function eventCaptureBatch(\Voidhash\Generated\EventCapture\Model\IV1BatchPostBody $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\EventCapture\Endpoint\EventCaptureBatch($requestBody, $headerParameters), $fetch);
    }
    public static function create($httpClient = null, array $additionalPlugins = [], array $additionalNormalizers = [])
    {
        if (null === $httpClient) {
            $httpClient = \Http\Discovery\Psr18ClientDiscovery::find();
            $plugins = [];
            if (count($additionalPlugins) > 0) {
                $plugins = array_merge($plugins, $additionalPlugins);
            }
            $httpClient = new \Http\Client\Common\PluginClient($httpClient, $plugins);
        }
        $requestFactory = \Http\Discovery\Psr17FactoryDiscovery::findRequestFactory();
        $streamFactory = \Http\Discovery\Psr17FactoryDiscovery::findStreamFactory();
        $normalizers = [new \Symfony\Component\Serializer\Normalizer\ArrayDenormalizer(), new \Voidhash\Generated\EventCapture\Normalizer\JaneObjectNormalizer()];
        if (count($additionalNormalizers) > 0) {
            $normalizers = array_merge($normalizers, $additionalNormalizers);
        }
        $serializer = new \Symfony\Component\Serializer\Serializer($normalizers, [new \Symfony\Component\Serializer\Encoder\JsonEncoder(new \Symfony\Component\Serializer\Encoder\JsonEncode(), new \Symfony\Component\Serializer\Encoder\JsonDecode(['json_decode_associative' => true]))]);
        return new static($httpClient, $requestFactory, $serializer, $streamFactory);
    }
}