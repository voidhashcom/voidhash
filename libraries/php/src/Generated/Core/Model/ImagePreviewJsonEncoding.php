<?php

namespace Voidhash\Generated\Core\Model;

class ImagePreviewJsonEncoding
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
     * The preview's media type, always `image/jpeg`.
     *
     * @var string
     */
    protected $contentType;
    /**
     * The JPEG, base64-encoded.
     *
     * @var string
     */
    protected $imageBase64;
    /**
     * The preview's width in pixels, at most 1568.
     *
     * @var int
     */
    protected $width;
    /**
     * The preview's height in pixels, at most 1568.
     *
     * @var int
     */
    protected $height;
    /**
     * The width in pixels of the image it was made from, upright.
     *
     * @var int
     */
    protected $sourceWidth;
    /**
     * The height in pixels of the image it was made from, upright.
     *
     * @var int
     */
    protected $sourceHeight;
    /**
     * The preview's media type, always `image/jpeg`.
     *
     * @return string
     */
    public function getContentType(): string
    {
        return $this->contentType;
    }
    /**
     * The preview's media type, always `image/jpeg`.
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
     * The JPEG, base64-encoded.
     *
     * @return string
     */
    public function getImageBase64(): string
    {
        return $this->imageBase64;
    }
    /**
     * The JPEG, base64-encoded.
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
    /**
     * The preview's width in pixels, at most 1568.
     *
     * @return int
     */
    public function getWidth(): int
    {
        return $this->width;
    }
    /**
     * The preview's width in pixels, at most 1568.
     *
     * @param int $width
     *
     * @return self
     */
    public function setWidth(int $width): self
    {
        $this->initialized['width'] = true;
        $this->width = $width;
        return $this;
    }
    /**
     * The preview's height in pixels, at most 1568.
     *
     * @return int
     */
    public function getHeight(): int
    {
        return $this->height;
    }
    /**
     * The preview's height in pixels, at most 1568.
     *
     * @param int $height
     *
     * @return self
     */
    public function setHeight(int $height): self
    {
        $this->initialized['height'] = true;
        $this->height = $height;
        return $this;
    }
    /**
     * The width in pixels of the image it was made from, upright.
     *
     * @return int
     */
    public function getSourceWidth(): int
    {
        return $this->sourceWidth;
    }
    /**
     * The width in pixels of the image it was made from, upright.
     *
     * @param int $sourceWidth
     *
     * @return self
     */
    public function setSourceWidth(int $sourceWidth): self
    {
        $this->initialized['sourceWidth'] = true;
        $this->sourceWidth = $sourceWidth;
        return $this;
    }
    /**
     * The height in pixels of the image it was made from, upright.
     *
     * @return int
     */
    public function getSourceHeight(): int
    {
        return $this->sourceHeight;
    }
    /**
     * The height in pixels of the image it was made from, upright.
     *
     * @param int $sourceHeight
     *
     * @return self
     */
    public function setSourceHeight(int $sourceHeight): self
    {
        $this->initialized['sourceHeight'] = true;
        $this->sourceHeight = $sourceHeight;
        return $this;
    }
}