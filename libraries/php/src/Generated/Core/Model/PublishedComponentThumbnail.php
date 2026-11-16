<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentThumbnail
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
     * The image, base64 encoded.
     *
     * @var string
     */
    protected $base64;
    /**
     * The image's media type: `image/png`, `image/svg+xml` or `image/webp` for the icon; `image/png`, `image/jpeg` or `image/webp` for a thumbnail.
     *
     * @var string
     */
    protected $contentType;
    /**
     * The preview state the thumbnail shows; one of the definition's `previewStates`.
     *
     * @var string
     */
    protected $state;
    /**
     * The image, base64 encoded.
     *
     * @return string
     */
    public function getBase64(): string
    {
        return $this->base64;
    }
    /**
     * The image, base64 encoded.
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
     * The image's media type: `image/png`, `image/svg+xml` or `image/webp` for the icon; `image/png`, `image/jpeg` or `image/webp` for a thumbnail.
     *
     * @return string
     */
    public function getContentType(): string
    {
        return $this->contentType;
    }
    /**
     * The image's media type: `image/png`, `image/svg+xml` or `image/webp` for the icon; `image/png`, `image/jpeg` or `image/webp` for a thumbnail.
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
    /**
     * The preview state the thumbnail shows; one of the definition's `previewStates`.
     *
     * @return string
     */
    public function getState(): string
    {
        return $this->state;
    }
    /**
     * The preview state the thumbnail shows; one of the definition's `previewStates`.
     *
     * @param string $state
     *
     * @return self
     */
    public function setState(string $state): self
    {
        $this->initialized['state'] = true;
        $this->state = $state;
        return $this;
    }
}