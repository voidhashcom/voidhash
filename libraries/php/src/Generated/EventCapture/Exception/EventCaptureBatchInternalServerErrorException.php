<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchInternalServerErrorException extends InternalServerErrorException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureInternalServerError
     */
    private $captureInternalServerError;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureInternalServerError $captureInternalServerError, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureInternalServerError');
        $this->captureInternalServerError = $captureInternalServerError;
        $this->response = $response;
    }
    public function getCaptureInternalServerError(): \Voidhash\Generated\EventCapture\Model\CaptureInternalServerError
    {
        return $this->captureInternalServerError;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}