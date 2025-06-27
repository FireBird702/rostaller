// This is a modified version of https://github.com/JohnnyMorganz/wally-package-types

use neon::prelude::*;

mod command;
mod link_mutator;
mod require_parser;
mod sourcemap;

use command::run;

fn generate_types(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let sourcemap = cx.argument::<JsString>(0)?.value(&mut cx) as String;
    let packages_folder = cx.argument::<JsString>(1)?.value(&mut cx) as String;

    let result = run(sourcemap, packages_folder);

    let (deferred, promise) = cx.promise();

    match result {
        Ok(()) => {
            let success = cx.boolean(true);
            deferred.resolve(&mut cx, success)
        }
        Err(e) => {
            let error = cx.string(e.to_string());
            deferred.reject(&mut cx, error)
        }
    }

    Ok(promise)
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("generate_types", generate_types)?;
    Ok(())
}
