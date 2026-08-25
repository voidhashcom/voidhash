<?php

namespace Voidhash\Generated\Core\Exception;

class IngestPolicyGetIngestPolicyBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiEventAdmissionErrorJsonEncoding
     */
    private $apiEventAdmissionErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiEventAdmissionErrorJsonEncoding $apiEventAdmissionErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/EventAdmissionError');
        $this->apiEventAdmissionErrorJsonEncoding = $apiEventAdmissionErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiEventAdmissionErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiEventAdmissionErrorJsonEncoding
    {
        return $this->apiEventAdmissionErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}