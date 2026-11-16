<?php

namespace Voidhash\Generated\Core\Model;

class AdCreativePreviewJsonEncoding
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
     * The picture's position among the creative's images and videos, from 0.
     *
     * @var int
     */
    protected $media;
    /**
     * How many images and videos the creative has, so `media` can be any of 0 to one less.
     *
     * @var int
     */
    protected $mediaCount;
    /**
     * What the picture is: an `image`, a video's poster frame (`video_frame`), or the platform's own small `thumbnail` of the creative when nothing larger was synced.
     *
     * @var string
     */
    protected $source;
    /**
     * A copy of an image small enough for a model to look at: upright, at most 1568 pixels on its longest side, and a JPEG on white.
     *
     * @var ImagePreviewJsonEncoding
     */
    protected $image;
    /**
     * The picture's position among the creative's images and videos, from 0.
     *
     * @return int
     */
    public function getMedia(): int
    {
        return $this->media;
    }
    /**
     * The picture's position among the creative's images and videos, from 0.
     *
     * @param int $media
     *
     * @return self
     */
    public function setMedia(int $media): self
    {
        $this->initialized['media'] = true;
        $this->media = $media;
        return $this;
    }
    /**
     * How many images and videos the creative has, so `media` can be any of 0 to one less.
     *
     * @return int
     */
    public function getMediaCount(): int
    {
        return $this->mediaCount;
    }
    /**
     * How many images and videos the creative has, so `media` can be any of 0 to one less.
     *
     * @param int $mediaCount
     *
     * @return self
     */
    public function setMediaCount(int $mediaCount): self
    {
        $this->initialized['mediaCount'] = true;
        $this->mediaCount = $mediaCount;
        return $this;
    }
    /**
     * What the picture is: an `image`, a video's poster frame (`video_frame`), or the platform's own small `thumbnail` of the creative when nothing larger was synced.
     *
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * What the picture is: an `image`, a video's poster frame (`video_frame`), or the platform's own small `thumbnail` of the creative when nothing larger was synced.
     *
     * @param string $source
     *
     * @return self
     */
    public function setSource(string $source): self
    {
        $this->initialized['source'] = true;
        $this->source = $source;
        return $this;
    }
    /**
     * A copy of an image small enough for a model to look at: upright, at most 1568 pixels on its longest side, and a JPEG on white.
     *
     * @return ImagePreviewJsonEncoding
     */
    public function getImage(): ImagePreviewJsonEncoding
    {
        return $this->image;
    }
    /**
     * A copy of an image small enough for a model to look at: upright, at most 1568 pixels on its longest side, and a JPEG on white.
     *
     * @param ImagePreviewJsonEncoding $image
     *
     * @return self
     */
    public function setImage(ImagePreviewJsonEncoding $image): self
    {
        $this->initialized['image'] = true;
        $this->image = $image;
        return $this;
    }
}