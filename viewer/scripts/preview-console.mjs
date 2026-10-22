// The exported document is deliberately sandboxed. Keep this exact expected
// denial separate from unexpected Viewer/preview errors; never swallow others.
export function blockedPreviewScript(message) {
  return message.type()==='error' && message.location().url==='about:srcdoc'
    && message.text()==="Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set."
}
