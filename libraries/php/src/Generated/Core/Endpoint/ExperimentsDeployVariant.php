<?php

namespace Voidhash\Generated\Core\Endpoint;

class ExperimentsDeployVariant extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $experimentId;
    protected $variantId;
    /**
     * Deploys a build of the paywall an arm shows at a location to that arm alone, in one environment or both, while the experiment runs or is paused: the arm shows it from now on, as shipping a fix to one arm needs. Deploying the paywall itself never changes an arm, which keeps the build it started with. The build must be a ready build of the same paywall that was deployed to each environment named before, normally its deployed build, and fit the location. Deploying the build the arm keeps changes nothing. Recorded in the arm's `buildChanges` and the audit log; results go on counting everyone in the arm. Fails with `not_found` (`experiment_not_found`) when the project has no such experiment, `not_found` (`experiment_variant_not_found`) when the experiment has no such arm, `invalid_request` (`invalid_build`) for a build that does not qualify, naming `paywallLocationId` when the arm shows no paywall at that location and `buildId` otherwise, `conflict` (`paywall_build_withdrawn`) for a withdrawn build, `conflict` (`experiment_not_started`) for a draft, `conflict` (`experiment_concluded` or `experiment_archived`), and `permission_denied` (`permission_denied`) when the caller may not publish paywalls (`project:paywalls:publish`).
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param string $variantId The arm's id, `exp_var_...`.
     * @param \Voidhash\Generated\Core\Model\DeployExperimentVariantBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $experimentId, string $variantId, \Voidhash\Generated\Core\Model\DeployExperimentVariantBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->experimentId = $experimentId;
        $this->variantId = $variantId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{experimentId}', '{variantId}'], [$this->projectId, $this->experimentId, $this->variantId], '/api/v1/projects/{projectId}/experiments/{experimentId}/variants/{variantId}/deploy');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\DeployExperimentVariantBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ExperimentVariantJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsDeployVariantInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}