<?php

namespace Voidhash\Generated\Core\Model;

class ProjectSettingsJsonEncodingPaidAccessSharing
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
     * How a purchase reported by another account is handled: `shared` lets both people keep access, `transfer` moves it to the person who reported it, `disabled` leaves it with the person who already has it.
     *
     * @var string
     */
    protected $production;
    /**
     * How a purchase reported by another account is handled: `shared` lets both people keep access, `transfer` moves it to the person who reported it, `disabled` leaves it with the person who already has it.
     *
     * @var string
     */
    protected $sandbox;
    /**
     * How a purchase reported by another account is handled: `shared` lets both people keep access, `transfer` moves it to the person who reported it, `disabled` leaves it with the person who already has it.
     *
     * @return string
     */
    public function getProduction(): string
    {
        return $this->production;
    }
    /**
     * How a purchase reported by another account is handled: `shared` lets both people keep access, `transfer` moves it to the person who reported it, `disabled` leaves it with the person who already has it.
     *
     * @param string $production
     *
     * @return self
     */
    public function setProduction(string $production): self
    {
        $this->initialized['production'] = true;
        $this->production = $production;
        return $this;
    }
    /**
     * How a purchase reported by another account is handled: `shared` lets both people keep access, `transfer` moves it to the person who reported it, `disabled` leaves it with the person who already has it.
     *
     * @return string
     */
    public function getSandbox(): string
    {
        return $this->sandbox;
    }
    /**
     * How a purchase reported by another account is handled: `shared` lets both people keep access, `transfer` moves it to the person who reported it, `disabled` leaves it with the person who already has it.
     *
     * @param string $sandbox
     *
     * @return self
     */
    public function setSandbox(string $sandbox): self
    {
        $this->initialized['sandbox'] = true;
        $this->sandbox = $sandbox;
        return $this;
    }
}