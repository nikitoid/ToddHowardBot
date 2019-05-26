const { VK, PhotoAttachment, AudioAttachment, DocumentAttachment, VideoAttachment, WallAttachment } = require('vk-io');
const NeDB = require('nedb');
const rufus = require('rufus');
const fs = require("fs");
const settings = require("./settings.json");

const users = new NeDB({filename: 'users.db', autoload: true });
const answersAttach = new NeDB({filename: 'answersAttach.db', autoload: true });
const vk = new VK({
  token: settings.TOKEN,
  pollingGroupId: settings.groupId
});
const logger = rufus.getLogger('./main.log');

let commands = fs.readdirSync("./commands").filter(x => x.endsWith(".js")).map(x => require("./commands/" + x));

// ------------------------------------------------------------------
//                  Начало обработки событий API
// ------------------------------------------------------------------
// vk.updates.on('message', context => {
//   // ------------- Команды -------------
// 	if(context.text == settings.helpCMD) return context.send("Все доступные команды:\n" + commands.map(x => {
//     if(x.description) { return x.description + '\n'; }
//   }));
	  
// 	commands.map(cmd => {
//     // проверки
// 		if(!cmd.r.test(context.text)) return; // выборка нужной команды
//     if(context.user == settings.id) return; // если отправитель не Павел Дуров(id = 1). Хз зачем это, но в примере было
//     if(cmd.admin == 1 && !isAdmin(context.senderId)) return; // если команда админская, а отправитель не админ

//     let params = context.text.match(cmd.r) || [];
    
// 		cmd.f(context, params, vk);
//   });
//   // -----------------------------------

//   processingAllMessages(context);
// });

vk.updates.hear(/(Тодд|Todd) \\saveme/i, context => {
  let user = {
    id: context.senderId
  };

  //получаем данные пользователя по VK id
  vk.api.users.get({user_ids: user.id, fields: 'sex,bdate'}).then(value => {
    let {first_name, last_name, sex, bdate} = value[0];

    user.first_name = first_name;
    user.last_name = last_name;
    user.sex = sex ? (sex === 2 ? 'мужской' : 'женский') : undefined;
    user.bdate = bdate;
    
    //проверяем есть ли уже такой объект в БД
    users.findOne({id: user.id}, (err, returnedDoc) => {
      if(!returnedDoc) {
        insert(users, user);
        context.send(`Будем знакомы, ${user.first_name} ${user.last_name}`);
        logger.info(`${user} добавлено в БД`);
      } else {
        context.send(`Я тебя уже знаю ${user.first_name} ${user.last_name}`);
        logger.info(`${user.id} уже существует и не был добавлен`);
      }
    });
  }, reason => {
    console.log('error!');
    console.log(reason);
  });
});

vk.updates.hear(/exec/i, context => {
  vk.api.messages.send({
    peer_id: 26669034,
    message: "Спокойной ночи от Тода"
  });
});

function processingAllMessages(context) {
  let messageTypes = getMessageTypes(context);
  
  // updateStatictic(context);

  // // собираем уникальное количество attach'ей в массив
  // let currentAttachs = unique(context.attachments.map(item => { return getMessageType(item) }));

  // // если есть attach'чи, то обрабатываем каждый
  // if (currentAttachs.length > 0) {
  //   currentAttachs.forEach(item => answerForAttach(context, item));
  // }
}

/*
vk.updates.on('message', (context, next) => {
  if(context.attachments)
  if(!isAdmin(context.senderId)) return;
  
  // собираем уникальное количество attach'ей в массив
  let currentAttachs = unique(context.attachments.map(item => { return getMessageType(item) }));

  // если есть attach'чи, то обрабатываем каждый
  if (currentAttachs.length > 0) {
    currentAttachs.forEach(item => answerForAttach(context, item));
  }

  return next();
});

vk.updates.hear(/exec/i, context => {
  // insert(answersAttach, {"type":"PhotoAttachment","text":"Нихуя непонятно, даже не объясняй"});
  // insert(answersAttach, {"type":"PhotoAttachment","text":"Ору :D"});
  // insert(answersAttach, {"type":"PhotoAttachment","text":"Заебался уже смотреть ваши картинки"});
});

vk.updates.hear(/(Тодд|Todd) \\saveme/i, context => {
  let user = {
    id: context.senderId
  };

  //получаем данные пользователя по VK id
  vk.api.users.get({user_ids: user.id, fields: 'sex,bdate'}).then(value => {
    let {first_name, last_name, sex, bdate} = value[0];

    user.first_name = first_name;
    user.last_name = last_name;
    user.sex = sex ? (sex === 2 ? 'мужской' : 'женский') : undefined;
    user.bdate = bdate;
    
    //проверяем есть ли уже такой объект в БД
    users.findOne({id: user.id}, (err, returnedDoc) => {
      if(!returnedDoc) {
        insert(users, user);
        context.send(`Будем знакомы, ${user.first_name} ${user.last_name}`);
        logger.info(`${user} добавлено в БД`);
      } else {
        context.send(`Я тебя уже знаю ${user.first_name} ${user.last_name}`);
        logger.info(`${user.id} уже существует и не был добавлен`);
      }
    });
  }, reason => {
    console.log('error!!!');
    console.log(reason);
  });
});

vk.updates.hear(/(привет|hello)/i, context => {
  context.send('Дратути');
});

vk.updates.hear(/омг ты заработал!/i, context => {
  context.send('Ееее биджо, маафака!');
});
*/
// ------------------------------------------------------------------
//                  Конец обработки событий API
// ------------------------------------------------------------------

function isAdmin(userId) {
  return settings.adminId.indexOf(userId) + 1;
}

// возвращает тип объект с ключами типов attach'ей и их количеством в значении
function getMessageTypes(context) {
  let types = {};

  if(context.text) types['Text'] = 1;
  if(context.attachments) context.attachments.map(item => {
    if(!types[item.constructor.name]) types[item.constructor.name] = 0;
    types[item.constructor.name]++;
  });

  return types;
}

// ответы на каждый attach
function answerForAttach(context, attachType) {
  // если шанс ответа не прокнул, то останавливаемся
  if (!decisionToAnswer(30)) return;
  
  // получаем из БД массив ответов по нужному attach'у и отправляем рандомный в чат
  answersAttach.find({type: attachType}, (err, result) => {
    let random = getRandomInt(0, result.length);
    context.send(result[random].text);
  })
}

function updateStatictic(context) {
  let objTypes = getMessageTypes(context);
  let types = Object.keys(objTypes);

  for(let i = 0; i < types.length; i++) {
    users.findOne({ id: context.senderId }, (err, user) => {
      if(err) {console.erroe(err); return;}
      let messageType = {};
      if(!user.statistics) users.update({ id: context.senderId }, { $set: { statistics: {} } });
      if(!user.statistics.messageCount) users.update({ id: context.senderId }, { $set: { statistics: { messageCount: {} } } });;
      if(!user.statistics.messageCount[types[i]]) {
        messageType[types[i]] = objTypes[types[i]];
        messageType = messageType[types[i]];
      } else {
        messageType += user.statistics.messageCount[types[i]] + objTypes[types[i]];
      }
      obj.text = '';
      obj['text'] = 
      
      // user.statistics.messageCount[types[i]] += objTypes[types[i]];
      // let obj = user.statistics.messageCount[types[i]];
  
      users.update({ id: context.senderId }, { $set: { statistics: { messageCount: messageType } } }, {}, err => {
        if(!err) {
          console.log("updated");
        }
      });
    });
  }
}

function _updateStatictic(userId, messageType) {
  users.findOne({ id: userid }, (err, user) => {
    if(err) {console.erroe(err); return;}

    if(!user.statistics.messageCount[messageType]) user.statistics.messageCount[messageType] = 0;
    let count = ++(user.statistics.messageCount[messageType]);

    users.update({ id: userid }, { $set: { statistics: { 'messageCount[messageType]': count } } }, {}, err => {
      if(!err) {
        console.log("updated");
      }
    });
  });
}

function insert(_db, doc){
  _db.insert(doc, (err, insertedDoc) => {
    if(!err) {
      console.log('Успешно добавлено!');
    }
  });
}

// принятие решения на ответ, по умолчанию 30%
function decisionToAnswer(chance = 30) {
  return getRandomInt(0, 101) < chance ? true : false;
}

// выборка уникальных значений и возврат нового массива этих значений
function unique(arr) {
  let obj = {};

  arr.forEach(item => obj[item] = true);

  return Object.keys(obj); // вернуть ключи
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

vk.updates.start().catch(console.error);
console.log('> Бот успешно запустился. Чтобы остановить нажмите Ctrl + C.');