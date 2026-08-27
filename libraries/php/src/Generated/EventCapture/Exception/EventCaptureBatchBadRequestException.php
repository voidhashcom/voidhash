<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestError
     */
    private $captureInvalidRequestError;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestError $captureInvalidRequestError, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureInvalidRequestError');
        $this->captureInvalidRequestError = $captureInvalidRequestError;
        $this->response = $response;
    }
    public function getCaptureInvalidRequestError(): \Voidhash\Generated\EventCapture\Model\CaptureInvalidRequestError
    {
        return $this->captureInvalidRequestError;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}