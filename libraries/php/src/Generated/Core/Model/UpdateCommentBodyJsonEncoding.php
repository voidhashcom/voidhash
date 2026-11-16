<?php

namespace Voidhash\Generated\Core\Model;

class UpdateCommentBodyJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * @var string
     */
    protected $body;
    /**
     * @return string
     */
    public function getBody(): string
    {
        return $this->body;
    }
    /**
     * @param string $body
     *
     * @return self
     */
    public function setBody(string $body): self
    {
        $this->initialized['body'] = true;
        $this->body = $body;
        return $this;
    }
}