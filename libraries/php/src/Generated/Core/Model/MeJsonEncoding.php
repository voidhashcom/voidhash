<?php

namespace Voidhash\Generated\Core\Model;

class MeJsonEncoding
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
     * The person's id, `user_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The person's name, from their sign-in account.
     *
     * @var string
     */
    protected $name;
    /**
     * The email address the person signs in with.
     *
     * @var string
     */
    protected $email;
    /**
     * Whether the person has verified their email address.
     *
     * @var bool
     */
    protected $isEmailVerified;
    /**
     * The URL of their uploaded picture, or else the one from their sign-in account; null when neither exists.
     *
     * @var string|null
     */
    protected $avatarUrl;
    /**
     * When the person's Voidhash account was created, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The person's id, `user_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The person's id, `user_...`.
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
     * The person's name, from their sign-in account.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The person's name, from their sign-in account.
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
     * The email address the person signs in with.
     *
     * @return string
     */
    public function getEmail(): string
    {
        return $this->email;
    }
    /**
     * The email address the person signs in with.
     *
     * @param string $email
     *
     * @return self
     */
    public function setEmail(string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
    /**
     * Whether the person has verified their email address.
     *
     * @return bool
     */
    public function getIsEmailVerified(): bool
    {
        return $this->isEmailVerified;
    }
    /**
     * Whether the person has verified their email address.
     *
     * @param bool $isEmailVerified
     *
     * @return self
     */
    public function setIsEmailVerified(bool $isEmailVerified): self
    {
        $this->initialized['isEmailVerified'] = true;
        $this->isEmailVerified = $isEmailVerified;
        return $this;
    }
    /**
     * The URL of their uploaded picture, or else the one from their sign-in account; null when neither exists.
     *
     * @return string|null
     */
    public function getAvatarUrl(): ?string
    {
        return $this->avatarUrl;
    }
    /**
     * The URL of their uploaded picture, or else the one from their sign-in account; null when neither exists.
     *
     * @param string|null $avatarUrl
     *
     * @return self
     */
    public function setAvatarUrl(?string $avatarUrl): self
    {
        $this->initialized['avatarUrl'] = true;
        $this->avatarUrl = $avatarUrl;
        return $this;
    }
    /**
     * When the person's Voidhash account was created, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the person's Voidhash account was created, as an ISO 8601 timestamp.
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