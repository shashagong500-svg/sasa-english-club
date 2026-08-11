// Textbook-aligned training flows for vocabulary, context tests, and speaking.

function v2Js(value) {
  return String(value == null ? "" : value).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\r\n]+/g, " ");
}

function v2UnitWords(grade, unit) {
  return (unit && unit.words || []).map(function(word) {
    var item = normWord(word, grade);
    return {e: item.e, c: item.c || item.e, p: item.p || "", s: item.s || "", x: item.x || "", xc: item.xc || ""};
  }).filter(function(word) { return !!word.e; });
}

function v2AllTextbookWords(grade) {
  var words = [];
  getGradeTB(grade).forEach(function(mod) {
    (mod.units || []).forEach(function(unit) { words = words.concat(v2UnitWords(grade, unit)); });
  });
  return words;
}

function v2UniqueOptions(correct, candidates, count) {
  var seen = {};
  var options = [];
  candidates.forEach(function(value) {
    value = String(value || "").trim();
    if (!value || value === correct || seen[value]) return;
    seen[value] = true;
    options.push(value);
  });
  shuffle(options);
  options = options.slice(0, Math.max(0, count - 1));
  options.push(correct);
  shuffle(options);
  return options;
}

function v2WordSyllables(word) {
  var source = String(word && word.s || "").trim();
  if (!source || /[.!?,;:]/.test(source) || source.indexOf("-") < 0) return [];
  return source.split(/[-\s]+/).filter(function(part) { return !!part; });
}

function v2FormQuestion(word, index) {
  var parts = v2WordSyllables(word);
  if (parts.length > 1) {
    var missing = index % parts.length;
    return {
      mode: "syllable",
      answer: parts[missing],
      display: parts.map(function(part, i) { return i === missing ? "_____" : part; }).join(" · "),
      prompt: "填入缺少的音节"
    };
  }
  return {mode: "spelling", answer: word.e, display: word.c, prompt: "根据中文和发音写出完整单词或短语"};
}

function startWordChallenge(grade, mid, uid) {
  var mod = findModule(grade, mid);
  var unit = findUnit(grade, mid, uid);
  if (!mod || !unit) return;
  var words = v2UnitWords(grade, unit).slice(0, 8);
  if (!words.length) { alert("本单元暂无单词训练内容"); return; }
  S.wcState = {
    grade: String(grade), mid: mid, uid: uid, mod: mod, unit: unit, words: words,
    idx: 0, stage: 0, points: 0, submitted: false, pronounced: false,
    meaningOk: false, formOk: false, recScore: null, formQuestion: null, results: []
  };
  render();
}

function renderWordChallenge() {
  var st = S.wcState;
  if (!st) return "";
  if (st.idx >= st.words.length) return renderWordChallengeResult();
  var word = st.words[st.idx];
  var stages = ["1 听音跟读", "2 理解词义", "3 音节拼写"];
  var h = '<div style="margin-bottom:12px"><a class="btn btn-l compact-btn" onclick="S.wcState=null;render()">‹ 返回</a></div>';
  h += '<div class="wc-prog">';
  for (var p = 0; p < st.words.length * 3; p++) {
    var current = st.idx * 3 + st.stage;
    h += '<i class="' + (p < current ? "done" : p === current ? "cur" : "") + '"></i>';
  }
  h += '</div>';
  h += '<div class="card">';
  h += '<div class="card-t">🎯 单词训练 <span class="tag tag-p">' + (st.idx + 1) + '/' + st.words.length + '</span></div>';
  h += '<div style="font-size:14px;font-weight:600">' + st.unit.ut + '</div>';
  h += '<div class="edition-note">' + editionName(st.grade) + '</div>';
  h += '<div class="stage-steps">';
  stages.forEach(function(label, i) { h += '<div class="stage-step ' + (i < st.stage ? "done" : i === st.stage ? "act" : "") + '">' + label + '</div>'; });
  h += '</div>';

  if (st.stage === 0) {
    h += '<div class="wc-word-focus"><div class="word">' + word.e + '</div><div class="phonetic">/' + word.p + '/</div>' + renderSyllables(word) + '</div>';
    h += '<button class="btn btn-s btn-blk" onclick="speak(\'' + v2Js(word.e) + '\',0.85)">🔊 听标准发音</button>';
    if (word.x) h += '<div class="wc-example"><div class="en">' + word.x + '</div><div class="zh">' + (word.xc || "") + '</div></div>';
    h += '<button class="btn btn-p btn-blk" style="margin-top:10px" id="wcRecBtn" onclick="wcRec()">🎤 录音跟读</button>';
    h += '<div id="wcAns"></div>';
  } else if (st.stage === 1) {
    h += '<div class="wc-word-focus"><div class="word">' + word.e + '</div><div class="phonetic">/' + word.p + '/</div></div>';
    h += '<div style="text-align:center;margin-bottom:10px"><button class="btn btn-s compact-btn" onclick="speak(\'' + v2Js(word.e) + '\',0.85)">🔊 再听一次</button></div>';
    h += '<div class="wc-q">请选择正确的中文意思</div><div class="wc-opts" id="wcOpts">';
    var meanings = v2UniqueOptions(word.c, v2AllTextbookWords(st.grade).map(function(item) { return item.c; }), 4);
    meanings.forEach(function(option) { h += '<div class="wc-opt" onclick="wcMeaningAnswer(this,\'' + v2Js(option) + '\')">' + option + '</div>'; });
    h += '</div><div id="wcAns"></div>';
  } else {
    if (!st.formQuestion) st.formQuestion = v2FormQuestion(word, st.idx);
    var form = st.formQuestion;
    h += '<div class="wc-word-focus"><div class="phonetic">/' + word.p + '/</div></div>';
    h += '<div class="wc-q" style="margin-bottom:8px">' + form.prompt + '</div>';
    h += '<div style="text-align:center;font-size:22px;font-weight:700;color:var(--pri);margin:12px 0;overflow-wrap:anywhere">' + form.display + '</div>';
    h += '<div style="text-align:center;margin-bottom:10px"><button class="btn btn-s compact-btn" onclick="speak(\'' + v2Js(word.e) + '\',0.85)">🔊 听发音</button></div>';
    h += '<input class="input" id="wcFormInput" placeholder="请输入答案" autocomplete="off" autocapitalize="none" onkeydown="if(event.key===\'Enter\')wcSubmitForm()">';
    h += '<button class="btn btn-p btn-blk" style="margin-top:10px" onclick="wcSubmitForm()">提交答案</button><div id="wcAns"></div>';
  }
  h += '</div>';
  return h;
}

function wcRec() {
  var st = S.wcState;
  var btn = document.getElementById("wcRecBtn");
  if (!st || !btn) return;
  if (stopAudioBtn(btn, "⏹ 结束录音", "btn btn-dan btn-blk")) return;
  var activeIndex = st.idx;
  var recording = toggleAudioRec(function(score) {
    if (!S.wcState || S.wcState.idx !== activeIndex) return;
    btn.textContent = "🎤 重新跟读";
    btn.className = "btn btn-p btn-blk";
    btn.disabled = false;
    if (!st.pronounced) { st.points++; markToday("read"); }
    st.pronounced = true;
    st.recScore = score.total;
    var ans = document.getElementById("wcAns");
    if (ans) ans.innerHTML = '<div class="ans ok">跟读完成 · 声音质量 ' + score.total + '分</div><button class="btn btn-g btn-blk" style="margin-top:10px" onclick="wcAdvanceStage(1)">继续理解词义 →</button>';
  });
  if (recording) { btn.textContent = "⏹ 结束录音"; btn.className = "btn btn-dan btn-blk"; }
}

function wcAdvanceStage(stage) {
  if (!S.wcState) return;
  S.wcState.stage = stage;
  S.wcState.submitted = false;
  render();
}

function wcMeaningAnswer(el, picked) {
  var st = S.wcState;
  if (!st || st.submitted) return;
  st.submitted = true;
  var word = st.words[st.idx];
  var ok = picked === word.c;
  st.meaningOk = ok;
  if (ok) st.points++;
  el.classList.add(ok ? "ok" : "no");
  document.querySelectorAll("#wcOpts .wc-opt").forEach(function(option) { if (option.textContent.trim() === word.c) option.classList.add("ok"); });
  var ans = document.getElementById("wcAns");
  if (ans) ans.innerHTML = '<div class="ans ' + (ok ? "ok" : "no") + '">' + (ok ? "理解正确" : "正确意思：" + word.c) + '</div><button class="btn btn-g btn-blk" style="margin-top:10px" onclick="wcAdvanceStage(2)">继续音节拼写 →</button>';
}

function wcSubmitForm() {
  var st = S.wcState;
  if (!st || st.submitted) return;
  var input = document.getElementById("wcFormInput");
  if (!input || !input.value.trim()) return;
  st.submitted = true;
  var answer = st.formQuestion.answer;
  var picked = input.value.trim();
  var ok = picked.toLowerCase() === answer.toLowerCase();
  st.formOk = ok;
  if (ok) st.points++;
  input.disabled = true;
  var ans = document.getElementById("wcAns");
  if (ans) ans.innerHTML = '<div class="ans ' + (ok ? "ok" : "no") + '">' + (ok ? "填写正确" : "正确答案：" + answer) + '</div><button class="btn btn-g btn-blk" style="margin-top:10px" onclick="wcNextWord()">' + (st.idx + 1 >= st.words.length ? "查看成绩" : "下一个单词 →") + '</button>';
}

function wcNextWord() {
  var st = S.wcState;
  if (!st) return;
  var word = st.words[st.idx];
  var mastered = st.meaningOk && st.formOk;
  st.results.push({word: word.e, meaningOk: st.meaningOk, formOk: st.formOk, recScore: st.recScore});
  markWord(word.e, mastered);
  if (!st.formOk) { DB.d.errors.push({word: word.e, date: Date.now()}); DB.save(); }
  st.idx++;
  st.stage = 0;
  st.submitted = false;
  st.pronounced = false;
  st.meaningOk = false;
  st.formOk = false;
  st.recScore = null;
  st.formQuestion = null;
  render();
}

function renderWordChallengeResult() {
  var st = S.wcState;
  var total = st.words.length * 3;
  var pct = Math.round(st.points / total * 100);
  var h = '<div class="card" style="text-align:center"><div style="font-size:48px;margin:10px 0">' + (pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "💪") + '</div>';
  h += '<div style="font-size:28px;font-weight:700;color:var(--pri)">' + st.points + '/' + total + '</div><div style="font-size:14px;color:var(--tl);margin-top:4px">跟读、词义与拼写综合完成度 ' + pct + '%</div>';
  h += '<div class="edition-note">' + editionName(st.grade) + ' · ' + st.unit.ut + '</div><div class="pbar" style="margin:14px 0"><i style="width:' + pct + '%"></i></div>';
  h += '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-p" style="flex:1" onclick="startWordChallenge(\'' + st.grade + '\',' + st.mid + ',' + st.uid + ')">🔄 再练一次</button><button class="btn btn-l" style="flex:1" onclick="S.wcState=null;render()">返回</button></div></div>';
  return h;
}

function v2InferQuestion(answer, unit) {
  var text = answer.en;
  if (/^(Hello|Hi)\b/i.test(text)) return "How do you greet a new classmate?";
  if (/^Nice to meet you\b/i.test(text)) return "What do you say when you meet someone?";
  if (/^Here you are\b/i.test(text)) return "What do you say when you give something?";
  if (/^Thank you\b/i.test(text)) return "What do you say after someone helps you?";
  if (/^Let's\b/i.test(text)) return "What shall we do?";
  if (/^I want\b/i.test(text)) return "What do you want?";
  if (/^I (like|love)\b/i.test(text)) return "What do you like?";
  if (/^I have\b/i.test(text)) return "What do you have?";
  if (/^I water\b/i.test(text)) return "What do you do every day?";
  if (/^I(?:'m| am) going to\b/i.test(text) || /^We(?:'re| are) going to\b/i.test(text)) return "What are you going to do?";
  if (/^I(?:'ve| have) got\b/i.test(text)) return "What's the matter?";
  if (/^I (save|spend|share)\b/i.test(text)) return "What do you do with money?";
  if (/^I am making\b/i.test(text)) return "What are you making?";
  if (/^I can see\b/i.test(text)) return "What can you see?";
  if (/^I can\b/i.test(text)) return "What can you do?";
  if (/^It will\b/i.test(text)) return "What will it do?";
  if (/^(You|We) should\b/i.test(text)) return "What should we do?";
  if (/^Friends should\b/i.test(text)) return "What should friends do?";
  if (/^Don't\b/i.test(text)) return "What shouldn't you do?";
  if (/^Every morning, you need\b/i.test(text)) return "What do you need every morning?";
  if (/^You need\b/i.test(text)) return "What do you need?";
  if (/^Please\b/i.test(text)) return "What should you do?";
  if (/^(Touch|Take off)\b/i.test(text)) return "What should you do?";
  if (/^Wait and see\b/i.test(text)) return "What should we do?";
  if (/^That's\b/i.test(text)) return "What do you think about that choice?";
  if (/^You can\b/i.test(text)) return "What can you do?";
  if (/^We can\b/i.test(text)) return "What can we do?";
  if (/^These are\b/i.test(text)) return "What are these?";
  if (/^They\b/i.test(text)) return "What do they do?";
  if (/^We use over\b/i.test(text)) return "How many milk boxes do we use every year?";
  if (/^Milk boxes have\b/i.test(text)) return "What parts do milk boxes have?";
  if (/^(Open|Make|Put|First|Then|Finally)\b/i.test(text)) return "What should you do next?";
  if (/^We(?:'re| are) from\b/i.test(text)) return "Where are you from?";
  if (/^We(?:'re| are) in\b/i.test(text)) return "Where are you?";
  if (/^There (is|are)\b/i.test(text)) return "What is there?";
  if (/^This is\b/i.test(text)) return "What is this?";
  if (/^It(?:'s| is)\b/i.test(text) && /colour/i.test(unit.pat || "")) return "What colour is it?";
  if (/^The golden touch\b/i.test(text)) return "Did the golden touch make King Midas happy?";
  if (/^Plants need\b/i.test(text)) return "What do plants need?";
  if (/^The tree is\b/i.test(text)) return "What is the tree like?";
  if (/^Cool clothes\b/i.test(text)) return "What do you think of the clothes?";
  if (/^He's wearing\b/i.test(text)) return "What is he wearing?";
  if (/^Our school's going to have\b/i.test(text)) return "What's your school going to have?";
  if (/^I'm in\b/i.test(text)) return "How do you feel?";
  if (/^The Mid-Autumn Festival is coming\b/i.test(text)) return "Which festival is coming?";
  if (/^My sweet home\b/i.test(text)) return "What do you think of your home?";
  if (/^For Duoduo\b/i.test(text)) return "Who is Duoduo's best friend?";
  if (/^Old friends and new friends\b/i.test(text)) return "What are old and new friends like?";
  if (/^Now Duoduo has\b/i.test(text)) return "How many best friends does Duoduo have?";
  if (/^Friends play together\b/i.test(text)) return "What do friends do together?";
  if (/^Travel gives\b/i.test(text)) return "What does travel give us?";
  if (/^Travel helps\b/i.test(text)) return "What does travel help us do?";
  if (/^What a wonderful world\b/i.test(text)) return "What do you think of the world?";
  var firstQuestion = (unit.text || []).map(normalizeSentence).map(function(item) { return item.en.split("—")[0].trim(); }).filter(function(item) { return /\?$/.test(item) && item.indexOf("___") < 0; })[0];
  return firstQuestion || ("What can you say about " + unit.ut + "?");
}

function v2LooksLikeAnswer(question, answer) {
  if (/^What do you want/i.test(question)) return /^I want\b/i.test(answer);
  if (/^What do you do/i.test(question)) return /^I\b/i.test(answer);
  if (/^What are you making/i.test(question)) return /^I am making\b/i.test(answer);
  if (/^What's the matter/i.test(question)) return /^I(?:'ve| have) got\b/i.test(answer);
  if (/^(Can|Are|Is|Do|Does|Did|Will)\b/i.test(question)) return /^(Yes|No)\b/i.test(answer);
  if (/^Where\b/i.test(question)) return /\b(in|at|on|from|next to|behind|near)\b/i.test(answer);
  if (/^How much\b/i.test(question)) return /\d|pound|dollar|yuan|It's|It is/i.test(answer);
  if (/^How many\b/i.test(question)) return /\d|one|two|three|four|five|six|seven|eight|nine|ten|There (is|are)/i.test(answer);
  return /^I\b/i.test(answer) && /\b(what|how)\b/i.test(question);
}

function v2SpeakingQuestions(unit) {
  var text = (unit.text || []).map(normalizeSentence);
  var questions = [];
  var used = {};
  text.forEach(function(item, index) {
    var parts = item.en.split(/\s+[—–-]\s+/);
    if (parts.length > 1 && /\?$/.test(parts[0])) {
      questions.push({question: parts[0], answer: parts.slice(1).join(" "), hint: (item.zh.split(/[—–]/)[1] || item.zh).trim()});
      used[index] = true;
    } else if (/\?$/.test(item.en) && text[index + 1] && !/\?$/.test(text[index + 1].en) && v2LooksLikeAnswer(item.en, text[index + 1].en)) {
      questions.push({question: item.en, answer: text[index + 1].en, hint: text[index + 1].zh});
      used[index] = true;
      used[index + 1] = true;
    }
  });
  text.filter(function(item, index) { return item.key && !used[index] && !/\?$/.test(item.en); }).concat(text.filter(function(item, index) { return !used[index] && !/\?$/.test(item.en); })).forEach(function(item) {
    var question = v2InferQuestion(item, unit);
    var key = question + "|" + item.en;
    if (!used[key]) { questions.push({question: question, answer: item.en, hint: item.zh}); used[key] = true; }
  });
  return questions.slice(0, 5);
}

function startPattern(grade, mid, uid) {
  var mod = findModule(grade, mid);
  var unit = findUnit(grade, mid, uid);
  if (!mod || !unit) return;
  var questions = v2SpeakingQuestions(unit);
  if (!questions.length) { alert("本单元暂无口语回答题"); return; }
  S.ppState = {grade: String(grade), mid: mid, uid: uid, mod: mod, unit: unit, questions: questions, idx: 0, score: 0, done: false, results: [], recordingUrl: null};
  render();
}

function renderPattern() {
  var st = S.ppState;
  if (!st) return "";
  if (st.done || st.idx >= st.questions.length) return renderPatternResult();
  var item = st.questions[st.idx];
  var h = '<div style="margin-bottom:12px"><a class="btn btn-l compact-btn" onclick="S.ppState=null;render()">‹ 返回</a></div>';
  h += '<div class="wc-prog">';
  st.questions.forEach(function(_, i) { h += '<i class="' + (i < st.idx ? "done" : i === st.idx ? "cur" : "") + '"></i>'; });
  h += '</div><div class="card"><div class="card-t">🗣️ 口语回答 <span class="tag tag-p">' + (st.idx + 1) + '/' + st.questions.length + '</span></div>';
  h += '<div style="font-size:14px;font-weight:600">' + st.unit.ut + '</div><div class="edition-note">' + editionName(st.grade) + '</div>';
  h += '<div class="speaking-question"><div class="q">' + item.question + '</div><div class="hint">回答要点：' + item.hint + '</div></div>';
  h += '<button class="btn btn-s btn-blk" onclick="ppPlayQuestion()">🔊 听问题</button>';
  h += '<button class="btn btn-p btn-blk" style="margin-top:10px" id="ppRecBtn" onclick="ppRec()">🎤 录音回答</button><div id="ppAns"></div></div>';
  return h;
}

function ppPlayQuestion() {
  var st = S.ppState;
  if (st && st.questions[st.idx]) speak(st.questions[st.idx].question, 0.9);
}

function ppRec() {
  var st = S.ppState;
  var btn = document.getElementById("ppRecBtn");
  if (!st || !btn) return;
  if (stopAudioBtn(btn, "⏹ 结束回答", "btn btn-dan btn-blk")) return;
  var activeIndex = st.idx;
  var item = st.questions[activeIndex];
  var recording = toggleAudioRec(function(score, blob) {
    if (!S.ppState || S.ppState.idx !== activeIndex) return;
    btn.textContent = "🎤 重新回答";
    btn.className = "btn btn-p btn-blk";
    btn.disabled = false;
    if (st.recordingUrl) { try { URL.revokeObjectURL(st.recordingUrl); } catch(e) {} }
    st.recordingUrl = blob ? URL.createObjectURL(blob) : null;
    var firstAnswer = !st.results[activeIndex];
    st.results[activeIndex] = {score: score.total, answer: item.answer};
    if (firstAnswer) markToday("read");
    var ans = document.getElementById("ppAns");
    if (!ans) return;
    var playback = st.recordingUrl ? '<audio class="recording-playback" controls playsinline src="' + st.recordingUrl + '"></audio>' : "";
    ans.innerHTML = '<div class="ans ' + (score.total >= 60 ? "ok" : "no") + '">回答已录制 · 声音质量 ' + score.total + '分</div>' + playback + '<div class="answer-sample"><div style="font-size:12px">参考回答</div><div style="font-weight:600;margin-top:3px">' + item.answer + '</div><button class="btn btn-l compact-btn" style="margin-top:8px" onclick="speak(\'' + v2Js(item.answer) + '\',0.9)">🔊 听参考回答</button></div><button class="btn btn-g btn-blk" style="margin-top:10px" onclick="ppNext()">' + (activeIndex + 1 >= st.questions.length ? "查看口语结果" : "下一题 →") + '</button>';
  });
  if (recording) { btn.textContent = "⏹ 结束回答"; btn.className = "btn btn-dan btn-blk"; }
}

function ppNext() {
  var st = S.ppState;
  if (!st) return;
  if (st.recordingUrl) { try { URL.revokeObjectURL(st.recordingUrl); } catch(e) {} st.recordingUrl = null; }
  st.idx++;
  if (st.idx >= st.questions.length) {
    st.done = true;
    st.score = st.results.filter(function(result) { return result && result.score >= 60; }).length;
  }
  render();
}

function renderPatternResult() {
  var st = S.ppState;
  var total = st.questions.length;
  var h = '<div class="card" style="text-align:center"><div style="font-size:48px;margin:10px 0">🎙️</div><div style="font-size:28px;font-weight:700;color:var(--pri)">' + st.score + '/' + total + '</div>';
  h += '<div style="font-size:14px;color:var(--tl);margin-top:4px">已完成录音回答</div><div class="edition-note">' + editionName(st.grade) + ' · ' + st.unit.ut + '</div>';
  h += '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-p" style="flex:1" onclick="startPattern(\'' + st.grade + '\',' + st.mid + ',' + st.uid + ')">🔄 再答一次</button><button class="btn btn-l" style="flex:1" onclick="S.ppState=null;render()">返回</button></div></div>';
  return h;
}

function v2EscapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function v2BlankSentence(sentence, answer) {
  return sentence.replace(new RegExp("\\b" + v2EscapeRegExp(answer) + "\\b", "i"), "[[BLANK]]");
}

function v2ContextQuestions(grade, mod, selectedUnit) {
  var units = selectedUnit ? [selectedUnit] : (mod.units || []);
  var words = [];
  var sentences = [];
  units.forEach(function(unit) {
    words = words.concat(v2UnitWords(grade, unit));
    (unit.text || []).forEach(function(sentence) {
      var item = normalizeSentence(sentence);
      item.unit = unit;
      sentences.push(item);
    });
  });
  var allGradeWords = v2AllTextbookWords(grade);
  var questions = [];
  words.slice(0, 3).forEach(function(word) {
    questions.push({type: "vocab", label: "单词理解", title: word.e, audioParts: [word.e], answer: word.c, opts: v2UniqueOptions(word.c, allGradeWords.map(function(item) { return item.c; }), 4)});
  });
  var prioritized = sentences.filter(function(item) { return item.key; }).concat(sentences.filter(function(item) { return !item.key; }));
  var clozeCount = 0;
  prioritized.forEach(function(sentence) {
    if (clozeCount >= 3) return;
    var matches = words.slice().sort(function(a, b) { return b.e.length - a.e.length; }).filter(function(word) {
      return new RegExp("\\b" + v2EscapeRegExp(word.e) + "\\b", "i").test(sentence.en);
    });
    if (!matches.length) return;
    var answer = matches[0].e;
    var contextItems = prioritized.slice(0, 3);
    if (contextItems.indexOf(sentence) < 0) contextItems.push(sentence);
    var context = contextItems.map(function(item) { return item === sentence ? v2BlankSentence(item.en, answer) : item.en; }).join(" ");
    questions.push({type: "cloze", label: "语境填空", title: "根据段落选择缺少的单词", passage: context, audioParts: contextItems.map(function(item) { return item.en; }), answer: answer, opts: v2UniqueOptions(answer, allGradeWords.map(function(item) { return item.e; }), 4)});
    clozeCount++;
  });
  if (prioritized.length >= 2) {
    var source = prioritized.slice(0, 3);
    var summary = source.map(function(item) { return item.zh; }).join(" ");
    var otherSummaries = [];
    getGradeTB(grade).forEach(function(otherMod) {
      if (otherMod.mid == mod.mid) return;
      var otherText = otherMod.units && otherMod.units[0] && otherMod.units[0].text || [];
      if (otherText.length) otherSummaries.push(otherText.slice(0, 2).map(function(item) { return normalizeSentence(item).zh; }).join(" "));
    });
    questions.push({type: "context", label: "语境理解", title: "这段话表达的内容是？", passage: source.map(function(item) { return item.en; }).join(" "), audioParts: source.map(function(item) { return item.en; }), answer: summary, opts: v2UniqueOptions(summary, otherSummaries, 4), long: true});
  }
  return questions;
}

function startModuleTest(mid, uid) {
  var grade = S.grade;
  var mod = findModule(grade, mid);
  if (!mod) return;
  var unit = uid == null ? null : findUnit(grade, mid, uid);
  var questions = v2ContextQuestions(grade, mod, unit);
  if (!questions.length) { alert("当前单元暂无可用题目"); return; }
  S.testMod = {grade: String(grade), mid: mid, uid: unit && unit.uid, mod: mod, unit: unit, questions: questions, idx: 0, score: 0, answers: [], submitted: false, saved: false};
  render();
}

function renderModuleTest() {
  var st = S.testMod;
  if (!st) return "";
  if (st.idx >= st.questions.length) return renderTestResult();
  var q = st.questions[st.idx];
  var h = '<div style="margin-bottom:12px"><a class="btn btn-l compact-btn" onclick="S.testMod=null;render()">‹ 返回</a></div><div class="wc-prog">';
  st.questions.forEach(function(_, i) { h += '<i class="' + (i < st.idx ? "done" : i === st.idx ? "cur" : "") + '"></i>'; });
  h += '</div><div class="ts-q"><div class="qt">' + q.label + ' · ' + (st.idx + 1) + '/' + st.questions.length + '</div><div class="edition-note">' + editionName(st.grade) + '</div>';
  h += '<div class="qc">' + q.title + '</div>';
  if (q.passage) {
    var passageHtml = q.passage.split("[[BLANK]]").join('<span class="blank">?</span>');
    h += '<div class="context-passage">' + passageHtml + '</div>';
  }
  if (q.audioParts && q.audioParts.length) h += '<div style="text-align:center;margin:8px 0"><button class="btn btn-s compact-btn" onclick="testPlayAudio()">🔊 ' + (q.type === "vocab" ? "听单词" : "听语境") + '</button></div>';
  h += '<div class="opts ' + (q.long ? "long" : "") + '" id="testOpts">';
  q.opts.forEach(function(option) { h += '<div class="opt" onclick="testAnswer(this,\'' + v2Js(option) + '\')">' + option + '</div>'; });
  h += '</div><div id="testAns"></div></div><div id="testNext" style="display:none;text-align:center;margin-top:10px"><button class="btn btn-g" onclick="testNext()">' + (st.idx + 1 >= st.questions.length ? "查看结果" : "下一题 →") + '</button></div>';
  return h;
}

function testAnswer(el, picked) {
  var st = S.testMod;
  if (!st || st.submitted) return;
  st.submitted = true;
  var q = st.questions[st.idx];
  _testAudioToken++;
  stopSpeak();
  var ok = picked === q.answer;
  if (ok) st.score++;
  el.classList.add(ok ? "ok" : "no");
  document.querySelectorAll("#testOpts .opt").forEach(function(option) { if (option.textContent.trim() === q.answer) option.classList.add("ok"); });
  st.answers.push({q: q.title, picked: picked, correct: q.answer, ok: ok});
  var ans = document.getElementById("testAns");
  if (ans) ans.innerHTML = '<div class="ans ' + (ok ? "ok" : "no") + '">' + (ok ? "理解正确" : "正确答案：" + q.answer) + '</div>';
  var next = document.getElementById("testNext");
  if (next) next.style.display = "block";
}

var _testAudioToken = 0;
function testPlayAudio() {
  var st = S.testMod;
  if (!st || !st.questions[st.idx]) return;
  var parts = st.questions[st.idx].audioParts || [];
  if (!parts.length) return;
  var token = ++_testAudioToken;
  var index = 0;
  stopSpeak();
  function next() {
    if (token !== _testAudioToken || index >= parts.length) return;
    speakYd(parts[index++], 0.9, function() { if (token === _testAudioToken) setTimeout(next, 350); });
  }
  next();
}

function testNext() {
  if (!S.testMod || !S.testMod.submitted) return;
  S.testMod.idx++;
  S.testMod.submitted = false;
  render();
}

function renderTestResult() {
  var st = S.testMod;
  var total = st.questions.length;
  var pct = Math.round(st.score / total * 100);
  if (!st.saved) {
    var key = "mod" + st.mid + "_" + st.grade;
    DB.d.testScores[key] = {score: st.score, total: total, pct: pct, date: Date.now(), type: "context-v2"};
    markToday("test", key);
    st.saved = true;
  }
  var h = '<div class="card" style="text-align:center"><div style="font-size:48px;margin:10px 0">' + (pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "💪") + '</div><div style="font-size:32px;font-weight:700;color:var(--pri)">' + st.score + '/' + total + '</div>';
  h += '<div style="font-size:14px;color:var(--tl)">词义与语境理解正确率 ' + pct + '%</div><div class="edition-note">' + editionName(st.grade) + ' · ' + (st.unit ? st.unit.ut : st.mod.mt) + '</div><div class="pbar" style="margin:14px 0"><i style="width:' + pct + '%"></i></div></div>';
  h += '<div class="card"><div class="card-t">📝 答题回顾</div>';
  st.answers.forEach(function(answer, i) { h += '<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><div style="font-size:13px">' + (i + 1) + '. ' + answer.q + '</div><div style="font-size:12px;color:' + (answer.ok ? "var(--suc)" : "var(--dan)") + '">' + (answer.ok ? "正确" : answer.picked + " → " + answer.correct) + '</div></div>'; });
  h += '</div><div style="display:flex;gap:8px"><button class="btn btn-p" style="flex:1" onclick="startModuleTest(' + st.mid + ',' + (st.uid == null ? "null" : st.uid) + ')">🔄 再测一次</button><button class="btn btn-l" style="flex:1" onclick="S.testMod=null;render()">返回</button></div>';
  return h;
}
