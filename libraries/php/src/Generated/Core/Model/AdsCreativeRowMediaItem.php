<?php

namespace Voidhash\Generated\Core\Model;

class AdsCreativeRowMediaItem
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
     * Whether it is an `image` or a `video`.
     *
     * @var string
     */
    protected $type;
    /**
     * The image, or a video's poster frame; null when the platform names the image only by `imageHash`.
     *
     * @var string|null
     */
    protected $imageUrl;
    /**
     * The platform's hash of the image; null when it gave none.
     *
     * @var string|null
     */
    protected $imageHash;
    /**
     * The platform's id of the video; null for images.
     *
     * @var string|null
     */
    protected $videoId;
    /**
     * The platform's thumbnail of the video; null when it gave none.
     *
     * @var string|null
     */
    protected $thumbnailUrl;
    /**
     * A carousel card's own headline; null otherwise.
     *
     * @var string|null
     */
    protected $headline;
    /**
     * A carousel card's own description; null otherwise.
     *
     * @var string|null
     */
    protected $description;
    /**
     * A carousel card's own link; null otherwise.
     *
     * @var string|null
     */
    protected $link;
    /**
     * Whether it is an `image` or a `video`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Whether it is an `image` or a `video`.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The image, or a video's poster frame; null when the platform names the image only by `imageHash`.
     *
     * @return string|null
     */
    public function getImageUrl(): ?string
    {
        return $this->imageUrl;
    }
    /**
     * The image, or a video's poster frame; null when the platform names the image only by `imageHash`.
     *
     * @param string|null $imageUrl
     *
     * @return self
     */
    public function setImageUrl(?string $imageUrl): self
    {
        $this->initialized['imageUrl'] = true;
        $this->imageUrl = $imageUrl;
        return $this;
    }
    /**
     * The platform's hash of the image; null when it gave none.
     *
     * @return string|null
     */
    public function getImageHash(): ?string
    {
        return $this->imageHash;
    }
    /**
     * The platform's hash of the image; null when it gave none.
     *
     * @param string|null $imageHash
     *
     * @return self
     */
    public function setImageHash(?string $imageHash): self
    {
        $this->initialized['imageHash'] = true;
        $this->imageHash = $imageHash;
        return $this;
    }
    /**
     * The platform's id of the video; null for images.
     *
     * @return string|null
     */
    public function getVideoId(): ?string
    {
        return $this->videoId;
    }
    /**
     * The platform's id of the video; null for images.
     *
     * @param string|null $videoId
     *
     * @return self
     */
    public function setVideoId(?string $videoId): self
    {
        $this->initialized['videoId'] = true;
        $this->videoId = $videoId;
        return $this;
    }
    /**
     * The platform's thumbnail of the video; null when it gave none.
     *
     * @return string|null
     */
    public function getThumbnailUrl(): ?string
    {
        return $this->thumbnailUrl;
    }
    /**
     * The platform's thumbnail of the video; null when it gave none.
     *
     * @param string|null $thumbnailUrl
     *
     * @return self
     */
    public function setThumbnailUrl(?string $thumbnailUrl): self
    {
        $this->initialized['thumbnailUrl'] = true;
        $this->thumbnailUrl = $thumbnailUrl;
        return $this;
    }
    /**
     * A carousel card's own headline; null otherwise.
     *
     * @return string|null
     */
    public function getHeadline(): ?string
    {
        return $this->headline;
    }
    /**
     * A carousel card's own headline; null otherwise.
     *
     * @param string|null $headline
     *
     * @return self
     */
    public function setHeadline(?string $headline): self
    {
        $this->initialized['headline'] = true;
        $this->headline = $headline;
        return $this;
    }
    /**
     * A carousel card's own description; null otherwise.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * A carousel card's own description; null otherwise.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * A carousel card's own link; null otherwise.
     *
     * @return string|null
     */
    public function getLink(): ?string
    {
        return $this->link;
    }
    /**
     * A carousel card's own link; null otherwise.
     *
     * @param string|null $link
     *
     * @return self
     */
    public function setLink(?string $link): self
    {
        $this->initialized['link'] = true;
        $this->link = $link;
        return $this;
    }
}