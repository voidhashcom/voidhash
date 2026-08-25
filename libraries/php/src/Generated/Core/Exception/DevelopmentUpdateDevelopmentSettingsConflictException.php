<?php

namespace Voidhash\Generated\Core\Exception;

class DevelopmentUpdateDevelopmentSettingsConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiDevelopmentEnvironmentRequiredErrorJsonEncoding
     */
    private $apiDevelopmentEnvironmentRequiredErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiDevelopmentEnvironmentRequiredErrorJsonEncoding $apiDevelopmentEnvironmentRequiredErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/DevelopmentEnvironmentRequiredError');
        $this->apiDevelopmentEnvironmentRequiredErrorJsonEncoding = $apiDevelopmentEnvironmentRequiredErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiDevelopmentEnvironmentRequiredErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiDevelopmentEnvironmentRequiredErrorJsonEncoding
    {
        return $this->apiDevelopmentEnvironmentRequiredErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}