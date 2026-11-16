<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlQueryResultJsonEncoding
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
     * The result's columns in order, each with its name and VoidQL type.
     *
     * @var list<VoidQlQueryResultJsonEncodingColumnsItem>
     */
    protected $columns;
    /**
     * One object per row, keyed by column name; times are UTC `YYYY-MM-DD hh:mm:ss.sss` text and dates `YYYY-MM-DD`.
     *
     * @var list<array<string, mixed>>
     */
    protected $rows;
    /**
     * Whether the query had more rows than `limit`, so `rows` holds only the first ones.
     *
     * @var bool
     */
    protected $isTruncated;
    /**
     * The result's columns in order, each with its name and VoidQL type.
     *
     * @return list<VoidQlQueryResultJsonEncodingColumnsItem>
     */
    public function getColumns(): array
    {
        return $this->columns;
    }
    /**
     * The result's columns in order, each with its name and VoidQL type.
     *
     * @param list<VoidQlQueryResultJsonEncodingColumnsItem> $columns
     *
     * @return self
     */
    public function setColumns(array $columns): self
    {
        $this->initialized['columns'] = true;
        $this->columns = $columns;
        return $this;
    }
    /**
     * One object per row, keyed by column name; times are UTC `YYYY-MM-DD hh:mm:ss.sss` text and dates `YYYY-MM-DD`.
     *
     * @return list<array<string, mixed>>
     */
    public function getRows(): array
    {
        return $this->rows;
    }
    /**
     * One object per row, keyed by column name; times are UTC `YYYY-MM-DD hh:mm:ss.sss` text and dates `YYYY-MM-DD`.
     *
     * @param list<array<string, mixed>> $rows
     *
     * @return self
     */
    public function setRows(array $rows): self
    {
        $this->initialized['rows'] = true;
        $this->rows = $rows;
        return $this;
    }
    /**
     * Whether the query had more rows than `limit`, so `rows` holds only the first ones.
     *
     * @return bool
     */
    public function getIsTruncated(): bool
    {
        return $this->isTruncated;
    }
    /**
     * Whether the query had more rows than `limit`, so `rows` holds only the first ones.
     *
     * @param bool $isTruncated
     *
     * @return self
     */
    public function setIsTruncated(bool $isTruncated): self
    {
        $this->initialized['isTruncated'] = true;
        $this->isTruncated = $isTruncated;
        return $this;
    }
}