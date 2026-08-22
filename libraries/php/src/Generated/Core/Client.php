<?php

namespace Voidhash\Generated\Core;

class Client extends \Voidhash\Generated\Core\Runtime\Client\Client
{
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AuthSessionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AuthSessionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AuthSessionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function authSession(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AuthSession(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListApiKeysUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListApiKeysForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListApiKeysInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysListApiKeys(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysListApiKeys(), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateSecretKeyUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateSecretKeyForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysCreateSecretKeyInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysCreateSecretKey(\Voidhash\Generated\Core\Model\CreateSecretKeyBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysCreateSecretKey($requestBody), $fetch);
    }
    /**
     * @param string $apiKeyId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysDeleteApiKeyInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysDeleteApiKey(string $apiKeyId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysDeleteApiKey($apiKeyId), $fetch);
    }
    /**
     * @param string $apiKeyId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetApiKeyByIdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetApiKeyByIdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetApiKeyByIdNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysGetApiKeyByIdInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysGetApiKeyById(string $apiKeyId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysGetApiKeyById($apiKeyId), $fetch);
    }
    /**
     * @param string $apiKeyId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateSecretKeyUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateSecretKeyForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateSecretKeyNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysRotateSecretKeyInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiKeyWithRawKeyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysRotateSecretKey(string $apiKeyId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysRotateSecretKey($apiKeyId), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPersonsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPersonsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPersonsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function personsListPersons(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsListPersons(), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreatePersonBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreatePersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreatePersonForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreatePersonInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsCreatePerson(\Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsCreatePerson($requestBody), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\SetPersonAttributesBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsSetPersonAttributesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsSetPersonAttributesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsSetPersonAttributesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsSetPersonAttributes(\Voidhash\Generated\Core\Model\SetPersonAttributesBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsSetPersonAttributes($requestBody), $fetch);
    }
    /**
     * @param string $personId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsGetPersonById(string $personId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsGetPersonById($personId), $fetch);
    }
    /**
     * @param string $distinctId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByDistinctIdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByDistinctIdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByDistinctIdNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByDistinctIdInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsGetPersonByDistinctId(string $distinctId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsGetPersonByDistinctId($distinctId), $fetch);
    }
    /**
     * @param string $personId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonEntitlementsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsGetPersonEntitlements(string $personId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsGetPersonEntitlements($personId), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NotificationsSendNotificationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsSendNotificationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsSendNotificationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsSendNotificationConflictException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsSendNotificationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SendNotificationResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function notificationsSendNotification(\Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NotificationsSendNotification($requestBody), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsCreateOrganizationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsCreateOrganizationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsCreateOrganization(\Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsCreateOrganization($requestBody), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksListPerksUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksListPerksForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksListPerksInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function perksListPerks(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksListPerks(), $fetch);
    }
    /**
     * @param mixed $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysCreateDeployInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallDeploysCreateDeploy($requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallDeploysCreateDeploy($requestBody), $fetch);
    }
    /**
     * @param string $deployId
     * @param string $sha256
     * @param string|resource|\Psr\Http\Message\StreamInterface $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysUploadBlobInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallDeploysUploadBlob(string $deployId, string $sha256, $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallDeploysUploadBlob($deployId, $sha256, $requestBody), $fetch);
    }
    /**
     * @param string $deployId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysFinalizeDeployInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallDeploysFinalizeDeploy(string $deployId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallDeploysFinalizeDeploy($deployId), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsListPaywallLocations(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsListPaywallLocations(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function schemaGetSchema(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SchemaGetSchema(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaVersionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function schemaGetSchemaVersion(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SchemaGetSchemaVersion(), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateProjectUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateProjectForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateProjectInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsCreateProject(\Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsCreateProject($requestBody), $fetch);
    }
    /**
     * @param string $organizationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListProjectsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListProjectsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsListProjectsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsListProjects(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsListProjects($organizationId), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function productsListProducts(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsListProducts(), $fetch);
    }
    /**
     * @param string $productId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductPerksListProductPerksByProductIdInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductPerkJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function productPerksListProductPerksByProductId(string $productId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductPerksListProductPerksByProductId($productId), $fetch);
    }
    /**
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetPersonInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkPersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkGetPerson(array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkGetPerson($headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonConflictException
     * @throws \Voidhash\Generated\Core\Exception\SdkIdentifyPersonInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkPersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkIdentifyPerson(\Voidhash\Generated\Core\Model\SdkIdentifyBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkIdentifyPerson($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncPersonAttributesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkPersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkSyncPersonAttributes(\Voidhash\Generated\Core\Model\SdkSyncPersonAttributesBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkSyncPersonAttributes($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkSyncTransactionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkSyncTransactionResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkSyncTransaction(\Voidhash\Generated\Core\Model\ApiV1SdkSyncTransactionPostBody $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkSyncTransaction($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkDevelopmentPurchaseBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkDevelopmentPurchaseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkDevelopmentPurchaseInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkDevelopmentPurchase(\Voidhash\Generated\Core\Model\SdkDevelopmentPurchaseBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkDevelopmentPurchase($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkEvaluateFeatureFlagsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkEvaluateFeatureFlags(\Voidhash\Generated\Core\Model\EvaluateFeatureFlagsBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkEvaluateFeatureFlags($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkResolvePaywallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkResolvedPaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkResolvePaywall(\Voidhash\Generated\Core\Model\SdkResolvePaywallBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkResolvePaywall($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkGetSchemaUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetSchemaInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkGetSchema(array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkGetSchema($headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkRegisterDeviceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\RegisterDeviceResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkRegisterDevice(\Voidhash\Generated\Core\Model\RegisterDeviceBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkRegisterDevice($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkRefreshDeviceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkRefreshDevice(\Voidhash\Generated\Core\Model\RefreshDeviceBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkRefreshDevice($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding $requestBody
     * @param array{
     *    "x-distinct-id": string,
     *    "x-publishable-key": string,
     *    "x-client-bundle-id": string,
     *    "x-client-locale"?: string,
     *    "x-client-version"?: string,
     *    "x-is-backgrounded": string,
     *    "x-is-debug-build": string,
     *    "x-nonce"?: string,
     *    "x-observer-mode": string,
     *    "x-platform": string,
     *    "x-platform-brand"?: string,
     *    "x-platform-device"?: string,
     *    "x-platform-flavor": string,
     *    "x-platform-flavor-version"?: string,
     *    "x-platform-version"?: string,
     *    "x-preferred-locales"?: string,
     *    "x-sdk": string,
     *    "x-sdk-version": string,
     *    "x-storefront"?: string,
     *    "x-environment"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\SdkUnregisterDeviceInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkUnregisterDevice(\Voidhash\Generated\Core\Model\UnregisterDeviceBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkUnregisterDevice($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\UsersGetUserUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\UsersGetUserInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\UserJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function usersGetUser(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\UsersGetUser(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsListPaymentProviderConfigurationsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsListPaymentProviderConfigurationsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsListPaymentProviderConfigurationsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderConfigurationJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderConfigurationsListPaymentProviderConfigurations(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderConfigurationsListPaymentProviderConfigurations(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListPaymentProviderProductsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListPaymentProviderProductsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListPaymentProviderProductsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsListPaymentProviderProducts(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsListPaymentProviderProducts(), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookEndpointsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookEndpointsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookEndpointsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksListWebhookEndpoints(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksListWebhookEndpoints(), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksCreateWebhookEndpoint(\Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksCreateWebhookEndpoint($requestBody), $fetch);
    }
    /**
     * @param string $endpointId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksDeleteWebhookEndpoint(string $endpointId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksDeleteWebhookEndpoint($endpointId), $fetch);
    }
    /**
     * @param string $endpointId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksGetWebhookEndpoint(string $endpointId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksGetWebhookEndpoint($endpointId), $fetch);
    }
    /**
     * @param string $endpointId
     * @param \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksUpdateWebhookEndpoint(string $endpointId, \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksUpdateWebhookEndpoint($endpointId, $requestBody), $fetch);
    }
    /**
     * @param string $endpointId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksRotateWebhookSecret(string $endpointId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksRotateWebhookSecret($endpointId), $fetch);
    }
    /**
     * @param string $endpointId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksTestWebhookEndpoint(string $endpointId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksTestWebhookEndpoint($endpointId), $fetch);
    }
    /**
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookDeliveriesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookDeliveriesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookDeliveriesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding[] : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksListWebhookDeliveries(string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksListWebhookDeliveries(), $fetch);
    }
    /**
     * @param string $deliveryId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksGetWebhookDelivery(string $deliveryId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksGetWebhookDelivery($deliveryId), $fetch);
    }
    /**
     * @param string $deliveryId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksRetryWebhookDelivery(string $deliveryId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksRetryWebhookDelivery($deliveryId), $fetch);
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
        $normalizers = [new \Symfony\Component\Serializer\Normalizer\ArrayDenormalizer(), new \Voidhash\Generated\Core\Normalizer\JaneObjectNormalizer()];
        if (count($additionalNormalizers) > 0) {
            $normalizers = array_merge($normalizers, $additionalNormalizers);
        }
        $serializer = new \Symfony\Component\Serializer\Serializer($normalizers, [new \Symfony\Component\Serializer\Encoder\JsonEncoder(new \Symfony\Component\Serializer\Encoder\JsonEncode(), new \Symfony\Component\Serializer\Encoder\JsonDecode(['json_decode_associative' => true]))]);
        return new static($httpClient, $requestFactory, $serializer, $streamFactory);
    }
}