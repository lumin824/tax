
import Base from './base';

import _ from 'lodash';
import fs from 'fs';
import gm from 'gm';
import uuid from 'node-uuid';
import tesseract from 'node-tesseract';

import cheerio from 'cheerio';
import md5File from 'md5-file';
import moment from 'moment';
import crypto from 'crypto';

import url from 'url';
import qs from 'qs';

export default class extends Base {
  fetchCaptcha(){
    let codePath = 'code_' + uuid.v1() + '.jpg';
    return new Promise((resolve, reject)=>{
      let stream = gm(this.httpClient.get('http://wsbs.sdds.gov.cn/etax/captcha.jpg'))
        .operator('gray', 'threshold', 60, true).stream();
      stream.pipe(fs.createWriteStream(codePath));
      stream.on('end', ()=>{
        tesseract.process(codePath, (error, text)=>{
          fs.unlink(codePath);
          error ? reject(error) : resolve(_.trim(text));
        });
      });
    });
  }
  async login(username, password){

    let captcha = await this.fetchCaptcha();
    while(captcha.length != 4){
      captcha = await this.fetchCaptcha();
    }

    let ret = await this.httpPost('http://wsbs.sdds.gov.cn/etax/etax_login', {
      form: {
        _eventId:'submit', method:'nsrUP',license:'',no:'',name:'',userType:'QY',
        wsaction:'',username,password, captcha_key:captcha
      }
    });
    let errmsg, errno;
    let { location } = ret.response.headers;
    if(location == 'http://wsbs.sdds.gov.cn/etax/index.do'){
      errno = '0';
      errmsg = '';
    }else{
      let { login_error } = qs.parse(url.parse(location).query);
      if(login_error == 'E006'){
        errno = 'ERR_01';
        errmsg == '代码错误';
      }else if(login_error == 'user_not_found'){
        errno = 'ERR_02';
        errmsg = '密码错误';
      }else{
        errno = 'SYS_'+login_error;
        errmsg = login_error;
      }
    }
    return {errno, errmsg};
  }

  async data(){

    return {ok:'ok'};
  }
}
