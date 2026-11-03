-- A wish about a WHOLE work that its owner already owns.
--
-- The server now refuses it (WishlistService.refuseIfWorkAlreadyOwned), as it
-- did for volumes since V21: owning and wanting are two states of one object,
-- never two states at once. The entries created before this rule showed a
-- board game as "Possédé" under the Envies filter. The ownership wins, the
-- wish goes. A wish about a volume is not touched: it already had the rule.
DELETE FROM wishlist_entry w
WHERE w.variant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM ownership o
    WHERE o.entity_id = w.entity_id
      AND o.owner_id = w.owner_id
      AND o.status = 'OWNED'
  );
