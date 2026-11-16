<?php

namespace Voidhash\Generated\Core\Endpoint;

class AnalyticsReportAcquisition extends \Voidhash\Generated\Core\Runtime\Client\BaseEndpoint implements \Voidhash\Generated\Core\Runtime\Client\Endpoint
{
    protected $projectId;
    /**
     * Groups the people a network, campaign, ad set or ad brought in, or people by the surface they signed up on (web, iOS or Android), and reports what Voidhash measured for them on the web and in apps: visits, signups, measured app installs, trials, payers, revenue and refunds in one currency, the funnel by surface, where payers converted and the project's revenue coverage by credited touch. A signup is credited to the person's last touch with an ad network before it within the attribution window (the project's, unless `attributionWindowDays` overrides it), else to their last touch of any kind in that time, or to a touch up to an hour after it; a signup without one is unattributed. The person is acquired on that touch's day and their later revenue stays with it. People count from the earliest of signing up and first paying or starting a trial, so someone who buys and creates an account later stays with the touch before the purchase; other anonymous visitors count only as visits. Revenue counts once on the person an identify merge keeps, wherever they pay, and only production revenue counts by default. Money is in integer minor units of `currency`, such as cents.
     *
     * People a touch reached only after they had signed up, such as customers reached by retargeting, are reported only as `returningPeople`, `returningPayers` and `returningRevenue`, which are never part of other revenue. `selfReported` lists what at least 2 unattributed people answered in the `$acquisition_source` person trait. Fails with `invalid_request` (`invalid_report_request`) for a request over the size limits or in a currency without exchange rates for the period, with a message saying what to change, and `invalid_request` (`invalid_time_range`) for a bad range.
     * @param string $projectId The project's id, `proj_...`. A secret key works only in the project it belongs to.
     * @param \Voidhash\Generated\Core\Model\AcquisitionReportBodyJsonEncoding $requestBody
     */
    public function __construct(string $projectId, \Voidhash\Generated\Core\Model\AcquisitionReportBodyJsonEncoding $requestBody)
    {
        $this->projectId = $projectId;
        $this->body = $requestBody;
    }
    use \Voidhash\Generated\Core\Runtime\Client\EndpointTrait;
    public function getMethod(): string
    {
        return 'POST';
    }
    public function getUri(): string
    {
        return str_replace(['{projectId}'], [$this->projectId], '/api/v1/projects/{projectId}/analytics/reports/acquisition');
    }
    public function getBody(\Symfony\Component\Serializer\SerializerInterface $serializer, $streamFactory = null): array
    {
        if ($this->body instanceof \Voidhash\Generated\Core\Model\AcquisitionReportBodyJsonEncoding) {
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
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionBadRequestException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionUnauthorizedException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionForbiddenException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionNotFoundException
     * @throws \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionInternalServerErrorException
     *
     * @return null|\Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding
     */
    protected function transformResponseBody(\Psr\Http\Message\ResponseInterface $response, \Symfony\Component\Serializer\SerializerInterface $serializer, ?string $contentType = null)
    {
        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if (is_null($contentType) === false && (200 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            return $serializer->deserialize($body, 'Voidhash\Generated\Core\Model\AcquisitionReportResultJsonEncoding', 'json');
        }
        if (is_null($contentType) === false && (400 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionBadRequestException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (401 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionUnauthorizedException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\UnauthenticatedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (403 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionForbiddenException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (404 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionNotFoundException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding', 'json'), $response);
        }
        if (is_null($contentType) === false && (500 === $status && mb_strpos(strtolower($contentType), 'application/json') !== false)) {
            throw new \Voidhash\Generated\Core\Exception\AnalyticsReportAcquisitionInternalServerErrorException($serializer->deserialize($body, 'Voidhash\Generated\Core\Model\InternalErrorJsonEncoding', 'json'), $response);
        }
    }
    public function getAuthenticationScopes(): array
    {
        return ['secretKey', 'cliToken'];
    }
}