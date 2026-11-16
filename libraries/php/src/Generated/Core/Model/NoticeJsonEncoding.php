<?php

namespace Voidhash\Generated\Core\Model;

class NoticeJsonEncoding
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
     * The notice's id, `notice_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The organization that sent the notice, `org_...`.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * What happened, as `category.event`.
     *
     * @var string
     */
    protected $type;
    /**
     * What a notice is about: `billing`, `legal`, `security`, `account`, `integrations` or `product`. Billing, legal and security notices cannot be muted.
     *
     * @var string
     */
    protected $category;
    /**
     * The notice's title, in the person's notice language.
     *
     * @var string
     */
    protected $title;
    /**
     * The notice's text, as plain text in the person's notice language.
     *
     * @var string
     */
    protected $body;
    /**
     * Whether the notice needs action now; the dashboard shows it as a banner until it is resolved or archived.
     *
     * @var bool
     */
    protected $isUrgent;
    /**
     * When the notice was sent, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the person read the notice; null while it is unread.
     *
     * @var string|null
     */
    protected $readAt;
    /**
     * When the person archived the notice; null while it is in the inbox.
     *
     * @var string|null
     */
    protected $archivedAt;
    /**
     * When what the notice reported stopped holding, such as a raised spend cap; null while it still holds.
     *
     * @var string|null
     */
    protected $resolvedAt;
    /**
     * The notice's id, `notice_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The notice's id, `notice_...`.
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
     * The organization that sent the notice, `org_...`.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization that sent the notice, `org_...`.
     *
     * @param string $organizationId
     *
     * @return self
     */
    public function setOrganizationId(string $organizationId): self
    {
        $this->initialized['organizationId'] = true;
        $this->organizationId = $organizationId;
        return $this;
    }
    /**
     * What happened, as `category.event`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * What happened, as `category.event`.
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
     * What a notice is about: `billing`, `legal`, `security`, `account`, `integrations` or `product`. Billing, legal and security notices cannot be muted.
     *
     * @return string
     */
    public function getCategory(): string
    {
        return $this->category;
    }
    /**
     * What a notice is about: `billing`, `legal`, `security`, `account`, `integrations` or `product`. Billing, legal and security notices cannot be muted.
     *
     * @param string $category
     *
     * @return self
     */
    public function setCategory(string $category): self
    {
        $this->initialized['category'] = true;
        $this->category = $category;
        return $this;
    }
    /**
     * The notice's title, in the person's notice language.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * The notice's title, in the person's notice language.
     *
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * The notice's text, as plain text in the person's notice language.
     *
     * @return string
     */
    public function getBody(): string
    {
        return $this->body;
    }
    /**
     * The notice's text, as plain text in the person's notice language.
     *
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
    /**
     * Whether the notice needs action now; the dashboard shows it as a banner until it is resolved or archived.
     *
     * @return bool
     */
    public function getIsUrgent(): bool
    {
        return $this->isUrgent;
    }
    /**
     * Whether the notice needs action now; the dashboard shows it as a banner until it is resolved or archived.
     *
     * @param bool $isUrgent
     *
     * @return self
     */
    public function setIsUrgent(bool $isUrgent): self
    {
        $this->initialized['isUrgent'] = true;
        $this->isUrgent = $isUrgent;
        return $this;
    }
    /**
     * When the notice was sent, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the notice was sent, as an ISO 8601 timestamp.
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
    /**
     * When the person read the notice; null while it is unread.
     *
     * @return string|null
     */
    public function getReadAt(): ?string
    {
        return $this->readAt;
    }
    /**
     * When the person read the notice; null while it is unread.
     *
     * @param string|null $readAt
     *
     * @return self
     */
    public function setReadAt(?string $readAt): self
    {
        $this->initialized['readAt'] = true;
        $this->readAt = $readAt;
        return $this;
    }
    /**
     * When the person archived the notice; null while it is in the inbox.
     *
     * @return string|null
     */
    public function getArchivedAt(): ?string
    {
        return $this->archivedAt;
    }
    /**
     * When the person archived the notice; null while it is in the inbox.
     *
     * @param string|null $archivedAt
     *
     * @return self
     */
    public function setArchivedAt(?string $archivedAt): self
    {
        $this->initialized['archivedAt'] = true;
        $this->archivedAt = $archivedAt;
        return $this;
    }
    /**
     * When what the notice reported stopped holding, such as a raised spend cap; null while it still holds.
     *
     * @return string|null
     */
    public function getResolvedAt(): ?string
    {
        return $this->resolvedAt;
    }
    /**
     * When what the notice reported stopped holding, such as a raised spend cap; null while it still holds.
     *
     * @param string|null $resolvedAt
     *
     * @return self
     */
    public function setResolvedAt(?string $resolvedAt): self
    {
        $this->initialized['resolvedAt'] = true;
        $this->resolvedAt = $resolvedAt;
        return $this;
    }
}