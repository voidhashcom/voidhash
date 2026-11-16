<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentFileJsonEncoding
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
     * The file's contents, base64 encoded.
     *
     * @var string
     */
    protected $base64;
    /**
     * The file's media type, such as `image/png` or `text/markdown; charset=utf-8`.
     *
     * @var string
     */
    protected $contentType;
    /**
     * The file's contents, base64 encoded.
     *
     * @return string
     */
    public function getBase64(): string
    {
        return $this->base64;
    }
    /**
     * The file's contents, base64 encoded.
     *
     * @param string $base64
     *
     * @return self
     */
    public function setBase64(string $base64): self
    {
        $this->initialized['base64'] = true;
        $this->base64 = $base64;
        return $this;
    }
    /**
     * The file's media type, such as `image/png` or `text/markdown; charset=utf-8`.
     *
     * @return string
     */
    public function getContentType(): string
    {
        return $this->contentType;
    }
    /**
     * The file's media type, such as `image/png` or `text/markdown; charset=utf-8`.
     *
     * @param string $contentType
     *
     * @return self
     */
    public function setContentType(string $contentType): self
    {
        $this->initialized['contentType'] = true;
        $this->contentType = $contentType;
        return $this;
    }
}