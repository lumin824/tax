
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

export default class extends Base {
  fetchCaptcha(){
    let codePath = 'code_' + uuid.v1() + '.jpg';
    return new Promise((resolve, reject)=>{
      let stream = gm(this.httpClient.get('http://dzswj.szgs.gov.cn/JPEGServlet'))
        .operator('gray', 'threshold', 75, true).crop(78,30,1,1).stream();
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

    let sha1 = crypto.createHash('sha1');
    sha1.update(password);
    let nsrpwd = sha1.digest('hex');

    let ret = await this.httpPost('http://dzswj.szgs.gov.cn/api/auth/clientWt', {
      body: JSON.stringify({
        nsrpwd,nsrsbh:username,redirectURL:'',tagger:captcha,time:moment().format('YYYY-MM-DD HH:mm:ss')
      })
    });

    let result = JSON.parse(ret.body);
    let errmsg, errno;
    if(result.success){
      this._logininfo = result.data.nsrxxVO;
      errno = '0';
      errmsg = '';
    }else{
      errno = 'ERR_04';
      errmsg = '帐号或密码错误';
    }
    return {errno, errmsg};
  }

  async fetch_nsrjbxx(nsrsbh){
    let ret = await this.httpPost('http://dzswj.szgs.gov.cn/gzcx/gzcxAction_queryNsrxxBynsrsbh.do',{
      form: {nsrsbh}
    });
    let result = JSON.parse(ret);

    return result.data[0];
  }

  async data(){

    console.log(this._logininfo);
    let info = {
      ...this._logininfo,
      name: this._logininfo.nsrmc,
      zzjgdm: this._logininfo.zzjgDm
    };
    console.log('22222');
    return {info};
  }
}
