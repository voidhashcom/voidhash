<?php

namespace Voidhash\Generated\Core\Model;

class PaywallSupportedLocationJsonEncoding
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
     * The location's id, `pw_loc_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The location's slug; apps ask for the location by it.
     *
     * @var string
     */
    protected $slug;
    /**
     * The location's name, shown in the dashboard.
     *
     * @var string
     */
    protected $name;
    /**
     * Where the location is in the paywall's list, from 0.
     *
     * @var int
     */
    protected $position;
    /**
     * Whether the location is archived; an archived location counts for nothing the paywall may exchange.
     *
     * @var bool
     */
    protected $isArchived;
    /**
     * Whether the paywall is shown, placed by an A/B test, pinned or matched by a rule at the location, so the location cannot be removed from it now.
     *
     * @var bool
     */
    protected $isInUse;
    /**
     * Why the location cannot be removed now, and what to do first; null when it can.
     *
     * @var string|null
     */
    protected $inUseReason;
    /**
     * Where the location disagrees with another location the paywall is made for, so no interface is right for both, each with what to change and on which locations. A build of the paywall fails until there are none.
     *
     * @var list<LocationProblem>
     */
    protected $conflicts;
    /**
     * What an app provides at the location: the inputs it passes to a flow, the outputs and outcomes it reads back and the app actions it handles, with the `revision` it is at. A paywall can be shown at the location only when its deployed flow asks for nothing the interface lacks, and code generated for an app is built from it.
     *
     * @var LocationInterface
     */
    protected $interface;
    /**
     * @var string
     */
    protected $addedAt;
    /**
     * The location's id, `pw_loc_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The location's id, `pw_loc_...`.
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
     * The location's slug; apps ask for the location by it.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The location's slug; apps ask for the location by it.
     *
     * @param string $slug
     *
     * @return self
     */
    public function setSlug(string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
    /**
     * The location's name, shown in the dashboard.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The location's name, shown in the dashboard.
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
     * Where the location is in the paywall's list, from 0.
     *
     * @return int
     */
    public function getPosition(): int
    {
        return $this->position;
    }
    /**
     * Where the location is in the paywall's list, from 0.
     *
     * @param int $position
     *
     * @return self
     */
    public function setPosition(int $position): self
    {
        $this->initialized['position'] = true;
        $this->position = $position;
        return $this;
    }
    /**
     * Whether the location is archived; an archived location counts for nothing the paywall may exchange.
     *
     * @return bool
     */
    public function getIsArchived(): bool
    {
        return $this->isArchived;
    }
    /**
     * Whether the location is archived; an archived location counts for nothing the paywall may exchange.
     *
     * @param bool $isArchived
     *
     * @return self
     */
    public function setIsArchived(bool $isArchived): self
    {
        $this->initialized['isArchived'] = true;
        $this->isArchived = $isArchived;
        return $this;
    }
    /**
     * Whether the paywall is shown, placed by an A/B test, pinned or matched by a rule at the location, so the location cannot be removed from it now.
     *
     * @return bool
     */
    public function getIsInUse(): bool
    {
        return $this->isInUse;
    }
    /**
     * Whether the paywall is shown, placed by an A/B test, pinned or matched by a rule at the location, so the location cannot be removed from it now.
     *
     * @param bool $isInUse
     *
     * @return self
     */
    public function setIsInUse(bool $isInUse): self
    {
        $this->initialized['isInUse'] = true;
        $this->isInUse = $isInUse;
        return $this;
    }
    /**
     * Why the location cannot be removed now, and what to do first; null when it can.
     *
     * @return string|null
     */
    public function getInUseReason(): ?string
    {
        return $this->inUseReason;
    }
    /**
     * Why the location cannot be removed now, and what to do first; null when it can.
     *
     * @param string|null $inUseReason
     *
     * @return self
     */
    public function setInUseReason(?string $inUseReason): self
    {
        $this->initialized['inUseReason'] = true;
        $this->inUseReason = $inUseReason;
        return $this;
    }
    /**
     * Where the location disagrees with another location the paywall is made for, so no interface is right for both, each with what to change and on which locations. A build of the paywall fails until there are none.
     *
     * @return list<LocationProblem>
     */
    public function getConflicts(): array
    {
        return $this->conflicts;
    }
    /**
     * Where the location disagrees with another location the paywall is made for, so no interface is right for both, each with what to change and on which locations. A build of the paywall fails until there are none.
     *
     * @param list<LocationProblem> $conflicts
     *
     * @return self
     */
    public function setConflicts(array $conflicts): self
    {
        $this->initialized['conflicts'] = true;
        $this->conflicts = $conflicts;
        return $this;
    }
    /**
     * What an app provides at the location: the inputs it passes to a flow, the outputs and outcomes it reads back and the app actions it handles, with the `revision` it is at. A paywall can be shown at the location only when its deployed flow asks for nothing the interface lacks, and code generated for an app is built from it.
     *
     * @return LocationInterface
     */
    public function getInterface(): LocationInterface
    {
        return $this->interface;
    }
    /**
     * What an app provides at the location: the inputs it passes to a flow, the outputs and outcomes it reads back and the app actions it handles, with the `revision` it is at. A paywall can be shown at the location only when its deployed flow asks for nothing the interface lacks, and code generated for an app is built from it.
     *
     * @param LocationInterface $interface
     *
     * @return self
     */
    public function setInterface(LocationInterface $interface): self
    {
        $this->initialized['interface'] = true;
        $this->interface = $interface;
        return $this;
    }
    /**
     * @return string
     */
    public function getAddedAt(): string
    {
        return $this->addedAt;
    }
    /**
     * @param string $addedAt
     *
     * @return self
     */
    public function setAddedAt(string $addedAt): self
    {
        $this->initialized['addedAt'] = true;
        $this->addedAt = $addedAt;
        return $this;
    }
}