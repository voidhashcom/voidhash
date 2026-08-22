<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchRequestEntityTooLargeException extends RequestEntityTooLargeException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeErrorJsonEncoding
     */
    private $capturePayloadTooLargeErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeErrorJsonEncoding $capturePayloadTooLargeErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CapturePayloadTooLargeError');
        $this->capturePayloadTooLargeErrorJsonEncoding = $capturePayloadTooLargeErrorJsonEncoding;
        $this->response = $response;
    }
    public function getCapturePayloadTooLargeErrorJsonEncoding(): \Voidhash\Generated\EventCapture\Model\CapturePayloadTooLargeErrorJsonEncoding
    {
        return $this->capturePayloadTooLargeErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}