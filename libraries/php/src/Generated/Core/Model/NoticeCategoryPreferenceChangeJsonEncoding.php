<?php

namespace Voidhash\Generated\Core\Model;

class NoticeCategoryPreferenceChangeJsonEncoding
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
     * What a notice is about: `billing`, `legal`, `security`, `account`, `integrations` or `product`. Billing, legal and security notices cannot be muted.
     *
     * @var string
     */
    protected $category;
    /**
     * Whether the category's notices reach the person's inbox.
     *
     * @var bool|null
     */
    protected $isInboxEnabled;
    /**
     * Whether the category's notices are emailed to the person.
     *
     * @var bool|null
     */
    protected $isEmailEnabled;
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
     * Whether the category's notices reach the person's inbox.
     *
     * @return bool|null
     */
    public function getIsInboxEnabled(): ?bool
    {
        return $this->isInboxEnabled;
    }
    /**
     * Whether the category's notices reach the person's inbox.
     *
     * @param bool|null $isInboxEnabled
     *
     * @return self
     */
    public function setIsInboxEnabled(?bool $isInboxEnabled): self
    {
        $this->initialized['isInboxEnabled'] = true;
        $this->isInboxEnabled = $isInboxEnabled;
        return $this;
    }
    /**
     * Whether the category's notices are emailed to the person.
     *
     * @return bool|null
     */
    public function getIsEmailEnabled(): ?bool
    {
        return $this->isEmailEnabled;
    }
    /**
     * Whether the category's notices are emailed to the person.
     *
     * @param bool|null $isEmailEnabled
     *
     * @return self
     */
    public function setIsEmailEnabled(?bool $isEmailEnabled): self
    {
        $this->initialized['isEmailEnabled'] = true;
        $this->isEmailEnabled = $isEmailEnabled;
        return $this;
    }
}