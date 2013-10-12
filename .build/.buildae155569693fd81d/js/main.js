/*******************************************************************************
 * @author Lukasz Jagodzinski <a href="mailto:l.jagodzinsk@samsung.com">l.jagodzinsk@samsung.com</a>
 * 
 * Copyright (c) 2012 Samsung Electronics All Rights Reserved.
 ******************************************************************************/
var app = (function ($) {
    'use strict';

    var _files, _context, _source, _gainNode, _pannerNode, _init, _listFilesInMusicDir, _loadSound, _playSound;

    _init = function () {
        var onListItemClickListener, onPlayButtonClickListener, onVolumeChangeListener, onPannerChangeListener, generateFilesList, initializeUI;

        _context = new webkitAudioContext(); /* Create contex object. */
        _source = null;
        /* Create gain and panner nodes. */
        _gainNode = _context.createGainNode(); // createGain()
        _pannerNode = _context.createPanner();
        /* Connect panner node to the gain node and later gain node to the
         * destination node. */
        _pannerNode.connect(_gainNode);
        _gainNode.connect(_context.destination);

        /* onListItemClickListener plays the clicked sound. */
        onListItemClickListener = function () {
            var a, file;

            a = $(this);

            file = {
                name : a.data('name'),
                uri : a.data('uri')
            };

            app.loadSound(file, function () {
                app.playSound(a.data('name'));
            });
        };

        /* onPlayButtonClickListener plays the sound from external URL. */
        onPlayButtonClickListener = function () {
            var url, file;

            url = $('#external').val();

            file = {
                name : 'external',
                uri : url
            };

            app.loadSound(file, function () {
                app.playSound('external');
            });
        };

        /* onVolumeChangeListener changes volume of the sound. */
        onVolumeChangeListener = function () {
            /* Slider's values range between 0 and 200 but the GainNode's default value equals 1. We have to dived slider's value by 100, but first we convert string value to the integer value. */
            _gainNode.gain.value = parseInt(this.value, 10) / 100;
        };

        /* onPannerChangeListener changes sound's position in space. */
        onPannerChangeListener = function () {
            /* setPosition() method takes 3 arguments x, y and z position of the sound in three dimensional space. We control only x axis. */
            _pannerNode.setPosition(this.value, 0, 0);
        };
        
        generateFilesList = function (files) {
            var ul, li, span, a;

            ul = $('#music-files');

            if (files.length > 0) {
                $.each(files, function (i, file) {
                    li = $('<li/>');
                    a = $('<a/>');
                    a.attr('data-role', 'none');
                    a.text(file.name);
                    a.data('name', file.name);
                    a.data('uri', file.toURI());
                    li.append(a);
                    ul.append(li);
                });
            } else {
                li = $('<li/>');
                span = $('<span/>');
                span.addClass('empty');
                span.text('No sound files in Music directory');
                li.append(span);
                ul.append(li);
            }

            /* Initialize all fields. */
            initializeUI();
        };

        /* Function initializes all fields in the application. */
        initializeUI = function () {
            $('#close').on('click', function() {
                tizen.application.getCurrentApplication().exit();
            });

            /* Initialize input for external resource. */
            $('#play').on('click', onPlayButtonClickListener);

            /* Initialize all lists. */
            $('li a').each(function() {
                $(this).on('click', onListItemClickListener);
            });

            /* Initialize volume field. */
            $('#volume').on('change', onVolumeChangeListener);

            /* Initialize panner field. */
            $('#panner').on('change', onPannerChangeListener);
        };

        /* Generate list of sound files stored in Music directory. */
        app.listFilesInMusicDir(generateFilesList);
    };

    _listFilesInMusicDir = function (onSuccess, onError) {
        var onMusicResolveSuccess, onListFilesSuccess;
        
        onMusicResolveSuccess = function (dir) {
            dir.listFiles(onListFilesSuccess, onError);
        };
        
        onListFilesSuccess = function (files) {
            var soundFiles;

            soundFiles = [];
            
            /* Loop through all files and get only that with supported
             * formats */
            $.each(files, function (i, file) {
                var name, extension;
                
                name = file.name;
                extension = name.substr(name.lastIndexOf('.') + 1);

                if (file.isFile && [ 'mp3', 'wav', 'ogg' ].indexOf(extension) > -1) {
                    soundFiles.push(file);
                }
            });
            
            onSuccess(soundFiles);
        };

        try {
            tizen.filesystem.resolve('music', onMusicResolveSuccess, onError);
        } catch (e) {
            tlib.logger.err(e);
        }
    };

    _loadSound = function (file, successCallback, errorCallback) {
        var xhr,
            isLoaded,
            onRequestLoad,
            onRequestError,
            onDecodeAudioDataSuccess,
            onDecodeAudioDataError,
            doXHRRequest;

        /* Stop execution if sound file to load was not given. */
        if (!file) {
            return;
        }

        /* Set default values. */
        _files = _files || [];
        successCallback = successCallback || function successCallback () {};
        errorCallback = errorCallback || function errorCallback (msg) {
            alert(msg);
        };

        /* Check if file with the same name is already in the list. */
        isLoaded = false;
        $.each(_files, function isFileAlreadyLoaded (i) {
            if (_files[i].name === file.name) {
                /* Set flag indicating that file is already loaded and stop
                 * 'each' function. */
                isLoaded = true;
                return false;
            }
        });
        
        /* When audio data is decoded add it to the files list. */
        onDecodeAudioDataSuccess = function (buffer) {
            if (!buffer) {
                errorCallback('Error decoding file ' + file.uri + ' data.');
                return;
            }
            /* Add sound file to loaded sounds list when loading succeeded. */
            _files.push({
                name : file.name,
                uri : file.uri,
                buffer : buffer
            });
            /* Hide loading indicator. */
            tlib.view.hideLoader();
            /* Execute callback function. */
            successCallback();
        };
        /* Display error message when audio data decoding failed. */
        onDecodeAudioDataError = function (error) {
            errorCallback('Error decoding file ' + file.uri + ' data.' + error);
        };
        
        /* When loading file is finished try to decode its audio data. */
        onRequestLoad = function () {
            /* Decode audio data. */
            _context.decodeAudioData(xhr.response, onDecodeAudioDataSuccess, onDecodeAudioDataError);
        };
        /* Display error message when file loading failed. */
        onRequestError = function () {
            errorCallback('XHR error when loading file ' + file.uri + '.');
        };
        
        /* Do AJAX request. */
        doXHRRequest = function () {
            xhr = new XMLHttpRequest();
            xhr.open('GET', file.uri, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = onRequestLoad;
            xhr.onloadstart = tlib.view.showLoader;
            xhr.onerror = onRequestError;
            xhr.send();
        };
        
        /* Try to load data. If it comes from external source check whether
         * Internet connection is active. If it's already loaded just execute
         * callback function. */
        if (isLoaded) {
            successCallback();
        } else if (file.uri.indexOf('http://') === 0 || file.uri.indexOf('https://') === 0) {
            tlib.network.isInternetConnection(function isInternetConnectionCallback (isActive) {
                if (isActive) {
                    doXHRRequest();
                } else {
                    errorCallback('There is no active Internet connection.');
                }
            });
        } else {
            doXHRRequest();
        }
    };

    _playSound = function (name) {
        /* Check whether any sound is being played. */
        if (_source && _source.playbackState === _source.PLAYING_STATE) {
            _source.noteOff(0); // stop()
            _source = null;
        }

        $.each(_files, function (i, file) {
            if (file.name === name) {
                /* Create SourceNode and add buffer to it. */
                _source = _context.createBufferSource();
                _source.buffer = file.buffer;
                /* Connect the SourceNode to the next node in the routing graph
                 * which is the PannerNode and play the sound. */
                _source.connect(_pannerNode);
                _source.noteOn(0); // start()
                
                return false;
            }
        });
    };

    return {
        /**
         * Initiates user interface and generate files list.
         */
        init : _init,
        /**
         * List files in 'Music' directory.
         * @param {Function} onSuccess Function executed on success
         * @param {Function} onError Function executed on error
         */
        listFilesInMusicDir : _listFilesInMusicDir,
        /**
         * Load sound file specified by the file parameter.
         * @param {Object} file It should be object with two properties 'name' - internal file name in the list and 'uri' - uri/url to the file.
         * @param {Function} successCallback
         * @param {Function} errorCallback
         */
        loadSound : _loadSound,
        /**
         * Play previously loaded sound.
         * @param {String} name Internal file name to be played.
         */
        playSound : _playSound
    };
}(jQuery));

window.onload = app.init;