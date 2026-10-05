/**
 * The collection types defined INSIDE iozycore - the fourth universe, the one
 * with no provider (Batch 133).
 *
 * <p>Mangas, video games and board games each have their own module and their
 * sources. Any other type (figurines, vinyl records, whatever the user wants to
 * collect) is created here, with its custom fields; its work pages are
 * entered by hand and found only through the iozycore database. The core
 * makes no difference: a work of a custom type is a work
 * like any other, with no extension point to implement - this is exactly
 * what makes it possible to add a type without writing code.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Types personnalisés")
package com.iozycore.custom;
