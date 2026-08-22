<?php

namespace Voidhash\Generated\EventCapture\Exception;

class EventCaptureBatchServiceUnavailableException extends ServiceUnavailableException
{
    /**
     * @var \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableError
     */
    private $captureDependencyUnavailableError;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableError $captureDependencyUnavailableError, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('CaptureDependencyUnavailableError');
        $this->captureDependencyUnavailableError = $captureDependencyUnavailableError;
        $this->response = $response;
    }
    public function getCaptureDependencyUnavailableError(): \Voidhash\Generated\EventCapture\Model\CaptureDependencyUnavailableError
    {
        return $this->captureDependencyUnavailableError;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}