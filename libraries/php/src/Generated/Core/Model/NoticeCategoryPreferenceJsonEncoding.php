<?php

namespace Voidhash\Generated\Core\Model;

class NoticeCategoryPreferenceJsonEncoding
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
     * Whether the category cannot be muted, as for billing, legal and security; both channels are then always on.
     *
     * @var bool
     */
    protected $isMandatory;
    /**
     * Whether the category's notices reach the person's inbox. On by default.
     *
     * @var bool
     */
    protected $isInboxEnabled;
    /**
     * Whether the category's notices are emailed to the person. On by default.
     *
     * @var bool
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
     * Whether the category cannot be muted, as for billing, legal and security; both channels are then always on.
     *
     * @return bool
     */
    public function getIsMandatory(): bool
    {
        return $this->isMandatory;
    }
    /**
     * Whether the category cannot be muted, as for billing, legal and security; both channels are then always on.
     *
     * @param bool $isMandatory
     *
     * @return self
     */
    public function setIsMandatory(bool $isMandatory): self
    {
        $this->initialized['isMandatory'] = true;
        $this->isMandatory = $isMandatory;
        return $this;
    }
    /**
     * Whether the category's notices reach the person's inbox. On by default.
     *
     * @return bool
     */
    public function getIsInboxEnabled(): bool
    {
        return $this->isInboxEnabled;
    }
    /**
     * Whether the category's notices reach the person's inbox. On by default.
     *
     * @param bool $isInboxEnabled
     *
     * @return self
     */
    public function setIsInboxEnabled(bool $isInboxEnabled): self
    {
        $this->initialized['isInboxEnabled'] = true;
        $this->isInboxEnabled = $isInboxEnabled;
        return $this;
    }
    /**
     * Whether the category's notices are emailed to the person. On by default.
     *
     * @return bool
     */
    public function getIsEmailEnabled(): bool
    {
        return $this->isEmailEnabled;
    }
    /**
     * Whether the category's notices are emailed to the person. On by default.
     *
     * @param bool $isEmailEnabled
     *
     * @return self
     */
    public function setIsEmailEnabled(bool $isEmailEnabled): self
    {
        $this->initialized['isEmailEnabled'] = true;
        $this->isEmailEnabled = $isEmailEnabled;
        return $this;
    }
}