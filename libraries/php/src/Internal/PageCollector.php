<?php

namespace Voidhash\Internal;

/** @internal */
final class PageCollector
{
    /**
     * Collects every page from a generated list endpoint.
     *
     * @template T
     * @param callable(array<string, string>): object|null $fetchPage
     * @return list<T>
     */
    public static function collect(callable $fetchPage): array
    {
        $items = [];
        $cursor = null;
        $seenCursors = [];

        while (true) {
            $query = $cursor === null ? [] : ['cursor' => $cursor];
            $page = $fetchPage($query);
            if ($page === null) {
                return $items;
            }

            array_push($items, ...$page->getData());
            $pageInfo = $page->getPageInfo();
            if (!$pageInfo->getHasNextPage()) {
                return $items;
            }

            $cursor = $pageInfo->getEndCursor();
            if ($cursor === null || isset($seenCursors[$cursor])) {
                throw new \UnexpectedValueException('Paginated response did not advance its cursor.');
            }
            $seenCursors[$cursor] = true;
        }
    }
}
