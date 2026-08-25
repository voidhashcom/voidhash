<?php

namespace Voidhash\Generated\Core\Exception;

class AnalyticsQueryInsightsUnprocessableEntityException extends UnprocessableEntityException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiUnknownInsightErrorJsonEncoding
     */
    private $apiUnknownInsightErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiUnknownInsightErrorJsonEncoding $apiUnknownInsightErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/UnknownInsightError');
        $this->apiUnknownInsightErrorJsonEncoding = $apiUnknownInsightErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiUnknownInsightErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiUnknownInsightErrorJsonEncoding
    {
        return $this->apiUnknownInsightErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}