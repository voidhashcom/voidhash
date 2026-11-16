<?php

namespace Voidhash\Generated\Core\Model;

class PutPaywallLocationPinBodyJsonEncoding
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
     * The paywall to show the end user, `pw_...`; it must have a deployed build.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * Why the pin exists, such as who is checking what, up to 255 characters. Omitted or null, the pin has no note.
     *
     * @var string|null
     */
    protected $note;
    /**
     * The paywall to show the end user, `pw_...`; it must have a deployed build.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The paywall to show the end user, `pw_...`; it must have a deployed build.
     *
     * @param string $paywallId
     *
     * @return self
     */
    public function setPaywallId(string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * Why the pin exists, such as who is checking what, up to 255 characters. Omitted or null, the pin has no note.
     *
     * @return string|null
     */
    public function getNote(): ?string
    {
        return $this->note;
    }
    /**
     * Why the pin exists, such as who is checking what, up to 255 characters. Omitted or null, the pin has no note.
     *
     * @param string|null $note
     *
     * @return self
     */
    public function setNote(?string $note): self
    {
        $this->initialized['note'] = true;
        $this->note = $note;
        return $this;
    }
}