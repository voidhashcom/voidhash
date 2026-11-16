<?php

namespace Voidhash\Generated\Core\Exception;

class PaymentSourcesRefundTransactionServiceUnavailableException extends ServiceUnavailableException
{
    /**
     * @var \Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding
     */
    private $unavailableErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding $unavailableErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`unavailable`: this deployment or a service it depends on cannot do it now.');
        $this->unavailableErrorJsonEncoding = $unavailableErrorJsonEncoding;
        $this->response = $response;
    }
    public function getUnavailableErrorJsonEncoding(): \Voidhash\Generated\Core\Model\UnavailableErrorJsonEncoding
    {
        return $this->unavailableErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}