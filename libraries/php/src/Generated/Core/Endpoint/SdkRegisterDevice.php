<?php

namespace Voidhash\Generated\Core\Endpoint;

class SdkRegisterDevice extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * Registers the device's push credential for the person `x-distinct-id` names, creating an anonymous person when there is none, and returns the device's id. Fails with `Api/ActionForbiddenError` when push notifications are not turned on for the team.
     * @param \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string, //The distinct id of the end user the request acts for: the anonymous `vh_anon_…` id the SDK generated, or the id the app identified them with. At most 255 characters.
     *    "x-distinct-id-encoding"?: string, //`percent` when `x-distinct-id` holds the RFC 3986 percent-encoded UTF-8 form of an id that is not printable ASCII; leave it out when the header holds the id as is.
     *    "x-publishable-key": string, //The project's publishable key, `vh_pk_…`. A test key, `vh_pk_test_…`, works with store sandbox and test purchases.
     *    "x-client-bundle-id": string, //The app's bundle id on iOS or package name on Android, which picks the project's store configuration for purchases and promotional offers.
     *    "x-client-locale"?: string, //The end user's most preferred locale, such as `en-US`.
     *    "x-client-version"?: string, //The app's version, such as `2.4.1`.
     *    "x-is-backgrounded": string, //`true` when the app sent the request from the background, otherwise `false`.
     *    "x-is-debug-build": string, //`true` when the app is a debug build, otherwise `false`. Only debug builds can make simulated development purchases.
     *    "x-nonce"?: string, //A random id, new for every request, such as a lowercase UUID.
     *    "x-observer-mode": string, //`true` when the SDK runs in observer mode: another billing integration owns purchases and the SDK only reports them. Otherwise `false`.
     *    "x-platform": string, //The platform the app runs on, such as `ios`, `android` or `web`. Records where a new person signed up.
     *    "x-platform-brand"?: string, //The device's manufacturer, such as `Apple` or `Google`.
     *    "x-platform-device"?: string, //The device's model, such as `iPhone15,2`; in a browser, its `navigator.platform`.
     *    "x-platform-flavor": string, //`native` in an app, `browser` in a web page.
     *    "x-platform-flavor-version"?: string, //The version of the app hosting the SDK; native SDKs send the app's version, the web SDK leaves it out.
     *    "x-platform-version"?: string, //The operating system's version, such as `17.4`; in a browser, its user agent.
     *    "x-preferred-locales"?: string, //The end user's preferred locales, most preferred first, separated by commas, such as `en-US,de-DE`.
     *    "x-sdk": string, //The SDK making the request: `ios`, `android`, `react-native` or `web`. A native SDK driven by another reports the outer one, such as `react-native`.
     *    "x-sdk-version": string, //The version of the SDK making the request, such as `1.4.0`.
     *    "x-storefront"?: string, //The app store storefront (country) the end user buys from, when the SDK knows it.
     * } $headerParameters
     */
    public function __construct(\Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody, array $headerParameters = [])
    {
        $this->body = $requestBody;
        $this->headerParameters = $headerParameters;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return '/api/v1/sdk/push-devices/register';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding) {
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
        $optionsResolver->setDefined(['x-distinct-id', 'x-distinct-id-encoding', 'x-publishable-key', 'x-client-bundle-id', 'x-client-locale', 'x-client-version', 'x-is-backgrounded', 'x-is-debug-build', 'x-nonce', 'x-observer-mode', 'x-platform', 'x-platform-brand', 'x-platform-device', 'x-platform-flavor', 'x-platform-flavor-version', 'x-platform-version', 'x-preferred-locales', 'x-sdk', 'x-sdk-version', 'x-storefront']);
        $optionsResolver->setRequired(['x-distinct-id', 'x-publishable-key', 'x-client-bundle-id', 'x-is-backgrounded', 'x-is-debug-build', 'x-observer-mode', 'x-platform', 'x-platform-flavor', 'x-sdk', 'x-sdk-version']);
        $optionsResolver->setDefaults([]);
        $optionsResolver->addAllowedTypes('x-distinct-id', ['string']);
        $optionsResolver->addAllowedTypes('x-distinct-id-encoding', ['string']);
        $optionsResolver->addAllowedTypes('x-publishable-key', ['string']);
        $optionsResolver->addAllowedTypes('x-client-bundle-id', ['string']);
        $optionsResolver->addAllowedTypes('x-client-locale', ['string']);
        $optionsResolver->addAllowedTypes('x-client-version', ['string']);
        $optionsResolver->addAllowedTypes('x-is-backgrounded', ['string']);
        $optionsResolver->addAllowedTypes('x-is-debug-build', ['string']);
        $optionsResolver->addAllowedTypes('x-nonce', ['string']);
        $optionsResolver->addAllowedTypes('x-observer-mode', ['string']);
        $optionsResolver->addAllowedTypes('x-platform', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-brand', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-device', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-flavor', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-flavor-version', ['string']);
        $optionsResolver->addAllowedTypes('x-platform-version', ['string']);
        $optionsResolver->addAllowedTypes('x-preferred-locales', ['string']);
        $optionsResolver->addAllowedTypes('x-sdk', ['string']);
        $optionsResolver->addAllowedTypes('x-sdk-version', ['string']);
        $optionsResolver->addAllowedTypes('x-storefront', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceBadRequestException($response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkRegisterDeviceInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['publishableKey', 'secretKey'];
    }
}