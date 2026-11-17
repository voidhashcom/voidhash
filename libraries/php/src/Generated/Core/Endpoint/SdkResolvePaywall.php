<?php

namespace Voidhash\Generated\Core\Endpoint;

class SdkResolvePaywall extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    /**
     * Resolves what a paywall location shows the person: the paywall and its deployed build (`paywallRelease`), with where to download it. Answers null when the location does not exist, shows nothing, or shows a build this version of the SDK cannot display.
     * @param \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding $requestBody
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
     *    "x-ui-package-abi"?: string, //The newest flow package format version the SDK's paywall engine reads.
     *    "x-ui-guest-abi"?: string, //The newest component guest ABI version the SDK's paywall engine runs. Without it the other engine headers are ignored and only releases a guest ABI 1 engine without native components can show are served.
     *    "x-ui-native-components"?: string, //The native components the SDK's paywall engine provides, as comma-separated `id@version` entries.
     *    "x-ui-runtime-bridge"?: string, //The newest runtime bridge version the SDK's paywall engine hosts, sent only when it runs the flow runtime as a downloaded module. Such an engine reads no package format itself: a release is served when a runtime module for it exists on a bridge the engine hosts, and `x-ui-package-abi` is not checked.
     * } $headerParameters
     */
    public function __construct(\Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding $requestBody, array $headerParameters = [])
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
        return '/api/v1/sdk/resolve-paywall';
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding) {
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
        $optionsResolver->setDefined(['x-distinct-id', 'x-distinct-id-encoding', 'x-publishable-key', 'x-client-bundle-id', 'x-client-locale', 'x-client-version', 'x-is-backgrounded', 'x-is-debug-build', 'x-nonce', 'x-observer-mode', 'x-platform', 'x-platform-brand', 'x-platform-device', 'x-platform-flavor', 'x-platform-flavor-version', 'x-platform-version', 'x-preferred-locales', 'x-sdk', 'x-sdk-version', 'x-storefront', 'x-ui-package-abi', 'x-ui-guest-abi', 'x-ui-native-components', 'x-ui-runtime-bridge']);
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
        $optionsResolver->addAllowedTypes('x-ui-package-abi', ['string']);
        $optionsResolver->addAllowedTypes('x-ui-guest-abi', ['string']);
        $optionsResolver->addAllowedTypes('x-ui-native-components', ['string']);
        $optionsResolver->addAllowedTypes('x-ui-runtime-bridge', ['string']);
        return $optionsResolver;
    }
    /**
     * {@inheritdoc}
     *
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkResolvePaywallBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiSdkValidationErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkResolvePaywallUnauthorizedException($response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\SdkResolvePaywallInternalServerErrorException($response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['publishableKey', 'secretKey'];
    }
}