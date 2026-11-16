<?php

namespace Voidhash\Generated\Core\Model;

class AvatarImageBodyJsonEncoding
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
     * The image's media type: `image/png`, `image/jpeg` or `image/webp`.
     *
     * @var string
     */
    protected $contentType;
    /**
     * The image file, base64-encoded, up to 2 MB before encoding.
     *
     * @var string
     */
    protected $imageBase64;
    /**
     * The image's media type: `image/png`, `image/jpeg` or `image/webp`.
     *
     * @return string
     */
    public function getContentType(): string
    {
        return $this->contentType;
    }
    /**
     * The image's media type: `image/png`, `image/jpeg` or `image/webp`.
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
     * The image file, base64-encoded, up to 2 MB before encoding.
     *
     * @return string
     */
    public function getImageBase64(): string
    {
        return $this->imageBase64;
    }
    /**
     * The image file, base64-encoded, up to 2 MB before encoding.
     *
     * @param string $imageBase64
     *
     * @return self
     */
    public function setImageBase64(string $imageBase64): self
    {
        $this->initialized['imageBase64'] = true;
        $this->imageBase64 = $imageBase64;
        return $this;
    }
}