<?php

namespace Voidhash\Generated\Core\Endpoint;

class ExperimentsReplaceVariants extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    protected $experimentId;
    /**
     * Replaces the experiment's arms, placements and flag values with the ones given and answers all of them. Name an existing arm's `id` to keep it, so end users in it stay there. Exactly one arm is the control and the weights total 100. An arm may show paywalls, give feature flags a value (`flagValues`), or both; a flag one arm gives a value, every arm must, and it has to be one of the project's own flags, not archived. An arm shows a paywall only at a location the paywall is made for (`paywalls.addLocation`); placing one elsewhere is `invalid_variants`. Fails with `invalid_request` (`invalid_variants`, `experiment_variant_not_found`, `paywall_not_found`, `paywall_location_not_found`) and with `conflict` (`experiment_variants_locked`) while it runs; pause it first.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param string $experimentId The experiment's id, `exp_...`.
     * @param \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, string $experimentId, \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->experimentId = $experimentId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'PUT';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}', '{experimentId}'], [$this->projectId, $this->experimentId], '/api/v1/projects/{projectId}/experiments/{experimentId}/variants');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\ReplaceExperimentVariantsBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsConflictException
     * @throws \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsPutResponse200
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ApiV1ProjectsProjectIdExperimentsExperimentIdVariantsPutResponse200', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (409 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsConflictException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\ExperimentsReplaceVariantsInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}