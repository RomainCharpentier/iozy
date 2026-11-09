package com.iozycore.core.application.auth;

import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.domain.user.AccountPreferences;
import com.iozycore.core.domain.user.AccountPreferencesRepository;
import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * The common profile (lot 218): who you are and what you chose, for both
 * apps.
 *
 * <h2>One change, all or nothing</h2>
 * A change can name a new pseudo and some preferences at once. Everything is
 * checked before anything is written, in one transaction: a refused pseudo
 * never leaves the preferences half saved.
 *
 * <h2>The pseudo keeps the sign-up rules</h2>
 * Same form (see {@link AppUser#PSEUDO_RULE}) and same uniqueness, ignoring
 * case. Your own pseudo with other capitals is not "taken": it is yours.
 */
@Service
@RequiredArgsConstructor
public class AccountProfile {

    private final AppUserRepository accounts;
    private final AccountPreferencesRepository preferences;

    /** The account as stored now - not as the session remembered it at sign-in. */
    public AppUser account(UUID accountId) {
        return accounts.findById(accountId).orElseThrow(() -> new NotFoundException("Ce compte n'existe plus."));
    }

    /** The preferences of the signed-in account. */
    public AccountPreferences preferences() {
        return preferences.find();
    }

    /**
     * Applies a change: a new pseudo (null keeps it) and the preferences the
     * change names (the others stay).
     *
     * @throws IllegalArgumentException the pseudo has a bad form or is taken
     */
    @Transactional
    public AppUser update(UUID accountId, String newPseudo, AccountPreferences change) {
        AppUser account = account(accountId);
        if (newPseudo != null && !newPseudo.trim().equals(account.pseudo())) {
            AppUser renamed = account.withPseudo(newPseudo);
            accounts.findByPseudo(renamed.pseudo())
                    .filter(other -> !other.id().equals(accountId))
                    .ifPresent(other -> {
                        throw new IllegalArgumentException("Ce pseudo est déjà pris.");
                    });
            account = accounts.save(renamed);
        }
        if (change != null && !change.equals(AccountPreferences.NONE)) {
            preferences.save(preferences.find().merge(change));
        }
        return account;
    }
}
