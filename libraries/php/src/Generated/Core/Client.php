<?php

namespace Voidhash\Generated\Core;

class Client extends \Voidhash\Generated\Core\Runtime\Client\Client
{
    /**
     * @param \Voidhash\Generated\Core\Model\QueryInsightsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsQueryInsightsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsQueryInsightsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsQueryInsightsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsQueryInsightsUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsQueryInsightsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\QueryInsightsResultJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function analyticsQueryInsights(\Voidhash\Generated\Core\Model\QueryInsightsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\AnalyticsQueryInsights($requestBody), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListApiKeysUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListApiKeysForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ApiKeysListApiKeysInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ApiKeysGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function apiKeysListApiKeys(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ApiKeysListApiKeys($queryParameters), $fetch);
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
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentSettingsConflictException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\DevelopmentSettings : \Psr\Http\Message\ResponseInterface)
     */
    public function developmentGetDevelopmentSettings(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\DevelopmentGetDevelopmentSettings($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\UpdateDevelopmentSettingsBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentUpdateDevelopmentSettingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentUpdateDevelopmentSettingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentUpdateDevelopmentSettingsConflictException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentUpdateDevelopmentSettingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\DevelopmentSettings : \Psr\Http\Message\ResponseInterface)
     */
    public function developmentUpdateDevelopmentSettings(\Voidhash\Generated\Core\Model\UpdateDevelopmentSettingsBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\DevelopmentUpdateDevelopmentSettings($requestBody), $fetch);
    }
    /**
     * @param array{
     *    "personId": string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentStateUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentStateForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentStateConflictException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentGetDevelopmentStateInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\DevelopmentState : \Psr\Http\Message\ResponseInterface)
     */
    public function developmentGetDevelopmentState(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\DevelopmentGetDevelopmentState($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\DevelopmentLifecycleActionBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionConflictException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentApplyDevelopmentLifecycleActionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1DevelopmentLifecycleActionsPostResponse202 : \Psr\Http\Message\ResponseInterface)
     */
    public function developmentApplyDevelopmentLifecycleAction(\Voidhash\Generated\Core\Model\DevelopmentLifecycleActionBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\DevelopmentApplyDevelopmentLifecycleAction($requestBody), $fetch);
    }
    /**
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentResetDevelopmentDataUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentResetDevelopmentDataForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentResetDevelopmentDataConflictException
     * @throws \Voidhash\Generated\Core\Exception\DevelopmentResetDevelopmentDataInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function developmentResetDevelopmentData(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\DevelopmentResetDevelopmentData($queryParameters), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "eventName"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\EventsListEventsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\EventsListEventsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\EventsListEventsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1EventsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function eventsListEvents(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\EventsListEvents($queryParameters), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "includeArchived"?: string,
     *    "projectId"?: string,
     *    "status"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListExperimentsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListExperimentsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsListExperimentsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ExperimentsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsListExperiments(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsListExperiments($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsCreateExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsCreateExperiment(\Voidhash\Generated\Core\Model\CreateExperimentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsCreateExperiment($requestBody), $fetch);
    }
    /**
     * @param string $experimentId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsArchiveExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsArchiveExperiment(string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsArchiveExperiment($experimentId), $fetch);
    }
    /**
     * @param string $experimentId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsGetExperiment(string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsGetExperiment($experimentId), $fetch);
    }
    /**
     * @param string $experimentId
     * @param \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateExperimentBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateExperimentConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsUpdateExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsUpdateExperiment(string $experimentId, \Voidhash\Generated\Core\Model\UpdateExperimentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsUpdateExperiment($experimentId, $requestBody), $fetch);
    }
    /**
     * @param string $experimentId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsRestoreExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsRestoreExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsRestoreExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsRestoreExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsRestoreExperiment(string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsRestoreExperiment($experimentId), $fetch);
    }
    /**
     * @param string $experimentId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartExperimentConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsStartExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsStartExperiment(string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsStartExperiment($experimentId), $fetch);
    }
    /**
     * @param string $experimentId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseExperimentConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsPauseExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsPauseExperiment(string $experimentId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsPauseExperiment($experimentId), $fetch);
    }
    /**
     * @param string $experimentId
     * @param \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsConcludeExperimentInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsConcludeExperiment(string $experimentId, \Voidhash\Generated\Core\Model\ConcludeExperimentBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsConcludeExperiment($experimentId, $requestBody), $fetch);
    }
    /**
     * @param string $experimentId
     * @param array{
     *    "days"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentResultsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentResultsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentResultsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsGetExperimentResultsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ExperimentResultsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function experimentsGetExperimentResults(string $experimentId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ExperimentsGetExperimentResults($experimentId, $queryParameters), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "featureFlagId"?: string,
     *    "identityType"?: string,
     *    "identityValue"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesListFeatureFlagOverridesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesListFeatureFlagOverridesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesListFeatureFlagOverridesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesListFeatureFlagOverridesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1FeatureFlagOverridesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagOverridesListFeatureFlagOverrides(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagOverridesListFeatureFlagOverrides($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesUpsertFeatureFlagOverrideInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagOverrideJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagOverridesUpsertFeatureFlagOverride(\Voidhash\Generated\Core\Model\UpsertFeatureFlagOverrideBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagOverridesUpsertFeatureFlagOverride($requestBody), $fetch);
    }
    /**
     * @param string $overrideId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagOverridesArchiveFeatureFlagOverrideInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagOverridesArchiveFeatureFlagOverride(string $overrideId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagOverridesArchiveFeatureFlagOverride($overrideId), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "featureFlagId": string,
     *    "listType"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsListFeatureFlagTargetsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsListFeatureFlagTargetsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsListFeatureFlagTargetsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsListFeatureFlagTargetsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1FeatureFlagTargetsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagTargetsListFeatureFlagTargets(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagTargetsListFeatureFlagTargets($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsUpsertFeatureFlagTargetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagTargetJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagTargetsUpsertFeatureFlagTarget(\Voidhash\Generated\Core\Model\UpsertFeatureFlagTargetBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagTargetsUpsertFeatureFlagTarget($requestBody), $fetch);
    }
    /**
     * @param string $targetId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsArchiveFeatureFlagTargetUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsArchiveFeatureFlagTargetForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsArchiveFeatureFlagTargetNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagTargetsArchiveFeatureFlagTargetInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagTargetsArchiveFeatureFlagTarget(string $targetId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagTargetsArchiveFeatureFlagTarget($targetId), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "includeArchived"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListFeatureFlagsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListFeatureFlagsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsListFeatureFlagsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1FeatureFlagsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsListFeatureFlags(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsListFeatureFlags($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateFeatureFlagConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsCreateFeatureFlagInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsCreateFeatureFlag(\Voidhash\Generated\Core\Model\CreateFeatureFlagBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsCreateFeatureFlag($requestBody), $fetch);
    }
    /**
     * @param string $featureFlagId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsArchiveFeatureFlagInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsArchiveFeatureFlag(string $featureFlagId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsArchiveFeatureFlag($featureFlagId), $fetch);
    }
    /**
     * @param string $featureFlagId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsGetFeatureFlagInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsGetFeatureFlag(string $featureFlagId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsGetFeatureFlag($featureFlagId), $fetch);
    }
    /**
     * @param string $featureFlagId
     * @param \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagConflictException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsUpdateFeatureFlagInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsUpdateFeatureFlag(string $featureFlagId, \Voidhash\Generated\Core\Model\UpdateFeatureFlagBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsUpdateFeatureFlag($featureFlagId, $requestBody), $fetch);
    }
    /**
     * @param string $featureFlagId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsRestoreFeatureFlagInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsRestoreFeatureFlag(string $featureFlagId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsRestoreFeatureFlag($featureFlagId), $fetch);
    }
    /**
     * @param string $featureFlagId
     * @param \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsReplaceFeatureFlagVariantsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\FeatureFlagJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsReplaceFeatureFlagVariants(string $featureFlagId, \Voidhash\Generated\Core\Model\ReplaceFeatureFlagVariantsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsReplaceFeatureFlagVariants($featureFlagId, $requestBody), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateProjectFeatureFlagsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateProjectFeatureFlagsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\FeatureFlagsEvaluateProjectFeatureFlagsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkFeatureFlagsResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function featureFlagsEvaluateProjectFeatureFlags(\Voidhash\Generated\Core\Model\EvaluateProjectFeatureFlagsBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\FeatureFlagsEvaluateProjectFeatureFlags($requestBody), $fetch);
    }
    /**
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetIngestPolicyBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetIngestPolicyUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetIngestPolicyForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicyGetIngestPolicyInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\EventAdmissionPolicyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function ingestPolicyGetIngestPolicy(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\IngestPolicyGetIngestPolicy($queryParameters), $fetch);
    }
    /**
     * @param string $key
     * @param \Voidhash\Generated\Core\Model\SetBuiltinEventAdmissionBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetBuiltinEventAdmissionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\EventAdmissionPolicyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function ingestPolicySetBuiltinEventAdmission(string $key, \Voidhash\Generated\Core\Model\SetBuiltinEventAdmissionBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\IngestPolicySetBuiltinEventAdmission($key, $requestBody), $fetch);
    }
    /**
     * @param string $eventName
     * @param \Voidhash\Generated\Core\Model\SetCustomEventBlockedBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\IngestPolicySetCustomEventBlockedInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\EventAdmissionPolicyJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function ingestPolicySetCustomEventBlocked(string $eventName, \Voidhash\Generated\Core\Model\SetCustomEventBlockedBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\IngestPolicySetCustomEventBlocked($eventName, $requestBody), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1NotificationSendsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function notificationSendsListNotificationSends(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NotificationSendsListNotificationSends($queryParameters), $fetch);
    }
    /**
     * @param string $sendId
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     *    "status"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\NotificationSendsListNotificationSendDeliveriesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1NotificationSendsSendIdDeliveriesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function notificationSendsListNotificationSendDeliveries(string $sendId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NotificationSendsListNotificationSendDeliveries($sendId, $queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding $requestBody
     * @param array{
     *    "idempotency-key"?: string,
     * } $headerParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\NotificationsCreateNotificationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsCreateNotificationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsCreateNotificationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsCreateNotificationConflictException
     * @throws \Voidhash\Generated\Core\Exception\NotificationsCreateNotificationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SendNotificationResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function notificationsCreateNotification(\Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding $requestBody, array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\NotificationsCreateNotification($requestBody, $headerParameters), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListOrganizationsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListOrganizationsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListOrganizationsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1OrganizationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsListOrganizations(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsListOrganizations($queryParameters), $fetch);
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
     * @param string $organizationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetOrganizationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetOrganizationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetOrganizationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsGetOrganizationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsGetOrganization(string $organizationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsGetOrganization($organizationId), $fetch);
    }
    /**
     * @param string $organizationId
     * @param \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateOrganizationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateOrganizationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateOrganizationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsUpdateOrganizationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\OrganizationJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsUpdateOrganization(string $organizationId, \Voidhash\Generated\Core\Model\UpdateOrganizationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsUpdateOrganization($organizationId, $requestBody), $fetch);
    }
    /**
     * @param string $organizationId
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListOrganizationProjectsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListOrganizationProjectsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\OrganizationsListOrganizationProjectsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1OrganizationsOrganizationIdProjectsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function organizationsListOrganizationProjects(string $organizationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\OrganizationsListOrganizationProjects($organizationId, $queryParameters), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     *    "providerId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsListPaymentProviderConfigurationsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsListPaymentProviderConfigurationsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsListPaymentProviderConfigurationsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderConfigurationsListPaymentProviderConfigurations(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderConfigurationsListPaymentProviderConfigurations($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePaymentProviderConfigurationBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsCreatePaymentProviderConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaymentProviderConfigurationsPostResponse201 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderConfigurationsCreatePaymentProviderConfiguration(\Voidhash\Generated\Core\Model\CreatePaymentProviderConfigurationBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderConfigurationsCreatePaymentProviderConfiguration($requestBody), $fetch);
    }
    /**
     * @param string $configurationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsDeletePaymentProviderConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderConfigurationsDeletePaymentProviderConfiguration(string $configurationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderConfigurationsDeletePaymentProviderConfiguration($configurationId), $fetch);
    }
    /**
     * @param string $configurationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsGetPaymentProviderConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderConfigurationSummary : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderConfigurationsGetPaymentProviderConfiguration(string $configurationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderConfigurationsGetPaymentProviderConfiguration($configurationId), $fetch);
    }
    /**
     * @param string $configurationId
     * @param \Voidhash\Generated\Core\Model\UpdatePaymentProviderConfigurationBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderConfigurationsUpdatePaymentProviderConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderConfigurationSummary : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderConfigurationsUpdatePaymentProviderConfiguration(string $configurationId, \Voidhash\Generated\Core\Model\UpdatePaymentProviderConfigurationBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderConfigurationsUpdatePaymentProviderConfiguration($configurationId, $requestBody), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "paymentProviderConfigurationId"?: string,
     *    "productId"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListPaymentProviderProductsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListPaymentProviderProductsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsListPaymentProviderProductsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaymentProviderProductsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsListPaymentProviderProducts(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsListPaymentProviderProducts($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePaymentProviderProductBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreatePaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreatePaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreatePaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreatePaymentProviderProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsCreatePaymentProviderProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaymentProviderProductsPostResponse201 : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsCreatePaymentProviderProduct(\Voidhash\Generated\Core\Model\CreatePaymentProviderProductBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsCreatePaymentProviderProduct($requestBody), $fetch);
    }
    /**
     * @param string $mappingId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsDeletePaymentProviderProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsDeletePaymentProviderProduct(string $mappingId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsDeletePaymentProviderProduct($mappingId), $fetch);
    }
    /**
     * @param string $mappingId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsGetPaymentProviderProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductSummary : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsGetPaymentProviderProduct(string $mappingId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsGetPaymentProviderProduct($mappingId), $fetch);
    }
    /**
     * @param string $mappingId
     * @param \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsUpdatePaymentProviderProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductSummary : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsUpdatePaymentProviderProduct(string $mappingId, \Voidhash\Generated\Core\Model\UpdatePaymentProviderProductBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsUpdatePaymentProviderProduct($mappingId, $requestBody), $fetch);
    }
    /**
     * @param string $mappingId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaymentProviderProductsActivatePaymentProviderProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaymentProviderProductSummary : \Psr\Http\Message\ResponseInterface)
     */
    public function paymentProviderProductsActivatePaymentProviderProduct(string $mappingId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaymentProviderProductsActivatePaymentProviderProduct($mappingId), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     *    "status"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysListDeploysUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysListDeploysForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysListDeploysInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaywallDeploysGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallDeploysListDeploys(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallDeploysListDeploys($queryParameters), $fetch);
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
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysGetDeployUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysGetDeployForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysGetDeployNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallDeploysGetDeployInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallDeployJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallDeploysGetDeploy(string $deployId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallDeploysGetDeploy($deployId, $queryParameters), $fetch);
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
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "includeArchived"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaywallLocationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsListPaywallLocations(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsListPaywallLocations($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreatePaywallLocationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreatePaywallLocationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreatePaywallLocationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsCreatePaywallLocationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsCreatePaywallLocation(\Voidhash\Generated\Core\Model\CreatePaywallLocationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsCreatePaywallLocation($requestBody), $fetch);
    }
    /**
     * @param string $locationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchivePaywallLocationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchivePaywallLocationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchivePaywallLocationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsArchivePaywallLocationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsArchivePaywallLocation(string $locationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsArchivePaywallLocation($locationId), $fetch);
    }
    /**
     * @param string $locationId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetPaywallLocationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetPaywallLocationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetPaywallLocationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsGetPaywallLocationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsGetPaywallLocation(string $locationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsGetPaywallLocation($locationId, $queryParameters), $fetch);
    }
    /**
     * @param string $locationId
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsUpdatePaywallLocationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsUpdatePaywallLocation(string $locationId, \Voidhash\Generated\Core\Model\UpdatePaywallLocationBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsUpdatePaywallLocation($locationId, $requestBody), $fetch);
    }
    /**
     * @param string $locationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearPaywallLocationShowingUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearPaywallLocationShowingForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearPaywallLocationShowingNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsClearPaywallLocationShowingInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsClearPaywallLocationShowing(string $locationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsClearPaywallLocationShowing($locationId), $fetch);
    }
    /**
     * @param string $locationId
     * @param \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsSetPaywallLocationShowingInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallLocationShowingJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsSetPaywallLocationShowing(string $locationId, \Voidhash\Generated\Core\Model\SetPaywallLocationShowingBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsSetPaywallLocationShowing($locationId, $requestBody), $fetch);
    }
    /**
     * @param string $locationId
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationShowingsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationShowingsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationShowingsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallLocationsListPaywallLocationShowingsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaywallLocationsLocationIdShowingsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallLocationsListPaywallLocationShowings(string $locationId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallLocationsListPaywallLocationShowings($locationId, $queryParameters), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "includeArchived"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListPaywallsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListPaywallsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListPaywallsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaywallsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsListPaywalls(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsListPaywalls($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallConflictException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsCreatePaywall(\Voidhash\Generated\Core\Model\CreatePaywallBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsCreatePaywall($requestBody), $fetch);
    }
    /**
     * @param string $paywallId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchivePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchivePaywallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchivePaywallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsArchivePaywallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsArchivePaywall(string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsArchivePaywall($paywallId), $fetch);
    }
    /**
     * @param string $paywallId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetPaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetPaywallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetPaywallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsGetPaywallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsGetPaywall(string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsGetPaywall($paywallId), $fetch);
    }
    /**
     * @param string $paywallId
     * @param \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsUpdatePaywallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsUpdatePaywall(string $paywallId, \Voidhash\Generated\Core\Model\UpdatePaywallBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsUpdatePaywall($paywallId, $requestBody), $fetch);
    }
    /**
     * @param string $paywallId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRestorePaywallUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRestorePaywallForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRestorePaywallNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsRestorePaywallInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsRestorePaywall(string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsRestorePaywall($paywallId), $fetch);
    }
    /**
     * @param string $paywallId
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "status"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListPaywallReleasesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListPaywallReleasesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListPaywallReleasesNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsListPaywallReleasesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PaywallsPaywallIdReleasesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsListPaywallReleases(string $paywallId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsListPaywallReleases($paywallId, $queryParameters), $fetch);
    }
    /**
     * @param string $paywallId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallReleaseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallReleaseForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallReleaseNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsCreatePaywallReleaseInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsCreatePaywallRelease(string $paywallId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsCreatePaywallRelease($paywallId), $fetch);
    }
    /**
     * @param string $paywallId
     * @param string $releaseId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsPublishPaywallReleaseInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PaywallReleaseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsPublishPaywallRelease(string $paywallId, string $releaseId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsPublishPaywallRelease($paywallId, $releaseId), $fetch);
    }
    /**
     * @param string $paywallId
     * @param string $releaseId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PaywallsActivatePaywallReleaseUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsActivatePaywallReleaseForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsActivatePaywallReleaseNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsActivatePaywallReleaseUnprocessableEntityException
     * @throws \Voidhash\Generated\Core\Exception\PaywallsActivatePaywallReleaseInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ActivatedPaywallReleaseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function paywallsActivatePaywallRelease(string $paywallId, string $releaseId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PaywallsActivatePaywallRelease($paywallId, $releaseId), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksListPerksUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksListPerksForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksListPerksInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PerksGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function perksListPerks(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksListPerks($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksCreatePerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreatePerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreatePerkConflictException
     * @throws \Voidhash\Generated\Core\Exception\PerksCreatePerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function perksCreatePerk(\Voidhash\Generated\Core\Model\CreatePerkBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksCreatePerk($requestBody), $fetch);
    }
    /**
     * @param string $perkId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksDeletePerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksDeletePerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksDeletePerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksDeletePerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function perksDeletePerk(string $perkId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksDeletePerk($perkId), $fetch);
    }
    /**
     * @param string $perkId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksGetPerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function perksGetPerk(string $perkId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksGetPerk($perkId), $fetch);
    }
    /**
     * @param string $perkId
     * @param \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkConflictException
     * @throws \Voidhash\Generated\Core\Exception\PerksUpdatePerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PerkJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function perksUpdatePerk(string $perkId, \Voidhash\Generated\Core\Model\UpdatePerkBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PerksUpdatePerk($perkId, $requestBody), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "distinctId"?: string,
     *    "email"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPersonsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPersonsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsListPersonsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PersonsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function personsListPersons(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsListPersons($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePersonRequestBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreatePersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreatePersonForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsCreatePersonInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function personsCreatePerson(\Voidhash\Generated\Core\Model\CreatePersonRequestBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsCreatePerson($requestBody), $fetch);
    }
    /**
     * @param string $personId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsGetPersonByIdInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function personsGetPersonById(string $personId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsGetPersonById($personId), $fetch);
    }
    /**
     * @param string $personId
     * @param \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdatePersonUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdatePersonForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdatePersonNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PersonsUpdatePersonInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PersonJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function personsUpdatePerson(string $personId, \Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PersonsUpdatePerson($personId, $requestBody), $fetch);
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
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     *    "type"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProductsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function productsListProducts(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsListProducts($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateProductConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProductsCreateProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function productsCreateProduct(\Voidhash\Generated\Core\Model\CreateProductBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsCreateProduct($requestBody), $fetch);
    }
    /**
     * @param string $productId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteProductBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDeleteProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function productsDeleteProduct(string $productId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsDeleteProduct($productId), $fetch);
    }
    /**
     * @param string $productId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsGetProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function productsGetProduct(string $productId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsGetProduct($productId), $fetch);
    }
    /**
     * @param string $productId
     * @param \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateProductUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateProductForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateProductNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateProductConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProductsUpdateProductInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function productsUpdateProduct(string $productId, \Voidhash\Generated\Core\Model\UpdateProductBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsUpdateProduct($productId, $requestBody), $fetch);
    }
    /**
     * @param string $productId
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductPerksBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductPerksUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductPerksForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductPerksNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsListProductPerksInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1ProductsProductIdPerksGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function productsListProductPerks(string $productId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsListProductPerks($productId, $queryParameters), $fetch);
    }
    /**
     * @param string $productId
     * @param \Voidhash\Generated\Core\Model\AttachProductPerkBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkConflictException
     * @throws \Voidhash\Generated\Core\Exception\ProductsAttachProductPerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProductPerkJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function productsAttachProductPerk(string $productId, \Voidhash\Generated\Core\Model\AttachProductPerkBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsAttachProductPerk($productId, $requestBody), $fetch);
    }
    /**
     * @param string $perkId
     * @param string $productId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProductsDetachProductPerkBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDetachProductPerkUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDetachProductPerkForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDetachProductPerkNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProductsDetachProductPerkInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function productsDetachProductPerk(string $perkId, string $productId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProductsDetachProductPerk($perkId, $productId), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateProjectUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateProjectForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsCreateProjectInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsCreateProject(\Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsCreateProject($requestBody), $fetch);
    }
    /**
     * @param string $projectId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteProjectUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteProjectForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteProjectNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsDeleteProjectInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsDeleteProject(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsDeleteProject($projectId), $fetch);
    }
    /**
     * @param string $projectId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetProjectByIdUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetProjectByIdForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetProjectByIdNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsGetProjectByIdInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsGetProjectById(string $projectId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsGetProjectById($projectId), $fetch);
    }
    /**
     * @param string $projectId
     * @param \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateProjectUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateProjectForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateProjectNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ProjectsUpdateProjectInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function projectsUpdateProject(string $projectId, \Voidhash\Generated\Core\Model\UpdateProjectBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\ProjectsUpdateProject($projectId, $requestBody), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     *    "providerId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListPushNotificationConfigurationsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListPushNotificationConfigurationsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsListPushNotificationConfigurationsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsListPushNotificationConfigurations(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsListPushNotificationConfigurations($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsCreatePushNotificationConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1PushNotificationConfigurationsPostResponse201 : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsCreatePushNotificationConfiguration(\Voidhash\Generated\Core\Model\CreatePushNotificationConfigurationBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsCreatePushNotificationConfiguration($requestBody), $fetch);
    }
    /**
     * @param string $configurationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeletePushNotificationConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeletePushNotificationConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeletePushNotificationConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsDeletePushNotificationConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsDeletePushNotificationConfiguration(string $configurationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsDeletePushNotificationConfiguration($configurationId), $fetch);
    }
    /**
     * @param string $configurationId
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsGetPushNotificationConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PushNotificationConfigurationSummary : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsGetPushNotificationConfiguration(string $configurationId, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsGetPushNotificationConfiguration($configurationId), $fetch);
    }
    /**
     * @param string $configurationId
     * @param \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBody $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationConflictException
     * @throws \Voidhash\Generated\Core\Exception\PushNotificationConfigurationsUpdatePushNotificationConfigurationInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\PushNotificationConfigurationSummary : \Psr\Http\Message\ResponseInterface)
     */
    public function pushNotificationConfigurationsUpdatePushNotificationConfiguration(string $configurationId, \Voidhash\Generated\Core\Model\UpdatePushNotificationConfigurationBody $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\PushNotificationConfigurationsUpdatePushNotificationConfiguration($configurationId, $requestBody), $fetch);
    }
    /**
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function schemaGetSchema(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SchemaGetSchema($queryParameters), $fetch);
    }
    /**
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaVersionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaVersionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\SchemaGetSchemaVersionInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function schemaGetSchemaVersion(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SchemaGetSchemaVersion($queryParameters), $fetch);
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
     * @throws \Voidhash\Generated\Core\Exception\SdkGetSdkSchemaUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\SdkGetSdkSchemaInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\SdkSchemaJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function sdkGetSdkSchema(array $headerParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\SdkGetSdkSchema($headerParameters), $fetch);
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
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookEndpointsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookEndpointsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookEndpointsInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1WebhooksEndpointsGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksListWebhookEndpoints(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksListWebhookEndpoints($queryParameters), $fetch);
    }
    /**
     * @param \Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding $requestBody
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksCreateWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointWithSecretJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksCreateWebhookEndpoint(\Voidhash\Generated\Core\Model\CreateWebhookEndpointBodyJsonEncoding $requestBody, string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksCreateWebhookEndpoint($requestBody), $fetch);
    }
    /**
     * @param string $endpointId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksDeleteWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksDeleteWebhookEndpoint(string $endpointId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksDeleteWebhookEndpoint($endpointId, $queryParameters), $fetch);
    }
    /**
     * @param string $endpointId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksGetWebhookEndpoint(string $endpointId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksGetWebhookEndpoint($endpointId, $queryParameters), $fetch);
    }
    /**
     * @param string $endpointId
     * @param \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding $requestBody
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksUpdateWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksUpdateWebhookEndpoint(string $endpointId, \Voidhash\Generated\Core\Model\UpdateWebhookEndpointBodyJsonEncoding $requestBody, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksUpdateWebhookEndpoint($endpointId, $requestBody, $queryParameters), $fetch);
    }
    /**
     * @param string $endpointId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRotateWebhookSecretInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookEndpointWithSecretJsonEncoding1 : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksRotateWebhookSecret(string $endpointId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksRotateWebhookSecret($endpointId, $queryParameters), $fetch);
    }
    /**
     * @param string $endpointId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksTestWebhookEndpointInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksTestWebhookEndpoint(string $endpointId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksTestWebhookEndpoint($endpointId, $queryParameters), $fetch);
    }
    /**
     * @param array{
     *    "cursor"?: string,
     *    "limit"?: string,
     *    "endpointId"?: string,
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookDeliveriesUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookDeliveriesForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksListWebhookDeliveriesInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\ApiV1WebhooksDeliveriesGetResponse200 : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksListWebhookDeliveries(array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksListWebhookDeliveries($queryParameters), $fetch);
    }
    /**
     * @param string $deliveryId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksGetWebhookDeliveryInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryWithAttemptsJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksGetWebhookDelivery(string $deliveryId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksGetWebhookDelivery($deliveryId, $queryParameters), $fetch);
    }
    /**
     * @param string $deliveryId
     * @param array{
     *    "projectId"?: string,
     * } $queryParameters
     * @param string $fetch Fetch mode to use (can be OBJECT or RESPONSE)
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\WebhooksRetryWebhookDeliveryInternalServerErrorException
     *
     * @return ($fetch is 'object' ? null|\Voidhash\Generated\Core\Model\WebhookDeliveryJsonEncoding : \Psr\Http\Message\ResponseInterface)
     */
    public function webhooksRetryWebhookDelivery(string $deliveryId, array $queryParameters = [], string $fetch = self::FETCH_OBJECT)
    {
        return $this->executeEndpoint(new \Voidhash\Generated\Core\Endpoint\WebhooksRetryWebhookDelivery($deliveryId, $queryParameters), $fetch);
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