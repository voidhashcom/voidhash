<?php

namespace Voidhash\Generated\Core\Model;

class AssetJsonEncoding
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
     * The asset's id, `asset_...`, or `pw_asset_...` for one uploaded in the paywall designer.
     *
     * @var string
     */
    protected $id;
    /**
     * The project whose library holds the asset.
     *
     * @var string
     */
    protected $projectId;
    /**
     * What kind of file the asset is: an `image` or `video` by its content type, a `font` uploaded as one, or a `document` for anything else.
     *
     * @var string
     */
    protected $kind;
    /**
     * The asset's name, at first the uploaded file's name.
     *
     * @var string
     */
    protected $name;
    /**
     * Where anyone can fetch the file without signing in, such as an ad platform importing a creative.
     *
     * @var string
     */
    protected $url;
    /**
     * The file's media type.
     *
     * @var string
     */
    protected $contentType;
    /**
     * The file's size in bytes.
     *
     * @var int
     */
    protected $sizeBytes;
    /**
     * An image's width in pixels; null for anything else.
     *
     * @var int|null
     */
    protected $width;
    /**
     * An image's height in pixels; null for anything else.
     *
     * @var int|null
     */
    protected $height;
    /**
     * Who uploaded it, `user:<id>` or `bot:<key>`; null when a project key did, or for assets from before that was recorded.
     *
     * @var string|null
     */
    protected $createdBy;
    /**
     * When the asset was uploaded, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The asset's id, `asset_...`, or `pw_asset_...` for one uploaded in the paywall designer.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The asset's id, `asset_...`, or `pw_asset_...` for one uploaded in the paywall designer.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The project whose library holds the asset.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project whose library holds the asset.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * What kind of file the asset is: an `image` or `video` by its content type, a `font` uploaded as one, or a `document` for anything else.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What kind of file the asset is: an `image` or `video` by its content type, a `font` uploaded as one, or a `document` for anything else.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The asset's name, at first the uploaded file's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The asset's name, at first the uploaded file's name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * Where anyone can fetch the file without signing in, such as an ad platform importing a creative.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * Where anyone can fetch the file without signing in, such as an ad platform importing a creative.
     *
     * @param string $url
     *
     * @return self
     */
    public function setUrl(string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
        return $this;
    }
    /**
     * The file's media type.
     *
     * @return string
     */
    public function getContentType(): string
    {
        return $this->contentType;
    }
    /**
     * The file's media type.
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
     * The file's size in bytes.
     *
     * @return int
     */
    public function getSizeBytes(): int
    {
        return $this->sizeBytes;
    }
    /**
     * The file's size in bytes.
     *
     * @param int $sizeBytes
     *
     * @return self
     */
    public function setSizeBytes(int $sizeBytes): self
    {
        $this->initialized['sizeBytes'] = true;
        $this->sizeBytes = $sizeBytes;
        return $this;
    }
    /**
     * An image's width in pixels; null for anything else.
     *
     * @return int|null
     */
    public function getWidth(): ?int
    {
        return $this->width;
    }
    /**
     * An image's width in pixels; null for anything else.
     *
     * @param int|null $width
     *
     * @return self
     */
    public function setWidth(?int $width): self
    {
        $this->initialized['width'] = true;
        $this->width = $width;
        return $this;
    }
    /**
     * An image's height in pixels; null for anything else.
     *
     * @return int|null
     */
    public function getHeight(): ?int
    {
        return $this->height;
    }
    /**
     * An image's height in pixels; null for anything else.
     *
     * @param int|null $height
     *
     * @return self
     */
    public function setHeight(?int $height): self
    {
        $this->initialized['height'] = true;
        $this->height = $height;
        return $this;
    }
    /**
     * Who uploaded it, `user:<id>` or `bot:<key>`; null when a project key did, or for assets from before that was recorded.
     *
     * @return string|null
     */
    public function getCreatedBy(): ?string
    {
        return $this->createdBy;
    }
    /**
     * Who uploaded it, `user:<id>` or `bot:<key>`; null when a project key did, or for assets from before that was recorded.
     *
     * @param string|null $createdBy
     *
     * @return self
     */
    public function setCreatedBy(?string $createdBy): self
    {
        $this->initialized['createdBy'] = true;
        $this->createdBy = $createdBy;
        return $this;
    }
    /**
     * When the asset was uploaded, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the asset was uploaded, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}