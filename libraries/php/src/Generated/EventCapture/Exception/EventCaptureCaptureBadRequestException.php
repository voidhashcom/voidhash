<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureCaptureBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestErrorJsonEncoding
     */
    private $captureInvalidRequestErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestErrorJsonEncoding $captureInvalidRequestErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureInvalidRequestError');
        $this->captureInvalidRequestErrorJsonEncoding = $captureInvalidRequestErrorJsonEncoding;
        $this->response = $response;
    }
    public function getCaptureInvalidRequestErrorJsonEncoding(): \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestErrorJsonEncoding
    {
        return $this->captureInvalidRequestErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}