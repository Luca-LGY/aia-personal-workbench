export interface WebdavConfig {url:string;username:string;secret:string;allowTestHTTP?:boolean}
export interface CapabilityReport {authenticated:boolean;conditionalWrite:boolean;conditionalDelete:boolean;createOnly:boolean;unicodePaths:boolean;completeListing:boolean;verifiedAt:string;issues:string[]}
export interface GithubConfig {owner:string;repo:string;branch:string;token:string;apiBase?:string}
